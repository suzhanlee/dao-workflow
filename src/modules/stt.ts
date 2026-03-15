import { createReadStream, statSync } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import Groq from 'groq-sdk';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { getConfig } from '../utils/config.js';
import { ProgressManager } from './progress.js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24MB (safe margin under Groq's 25MB limit)

/**
 * Transcription options
 */
export interface TranscribeOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
}

/**
 * Segment with timestamps
 */
export interface Segment {
  start: number;
  end: number;
  text: string;
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  text: string;
  segments: Segment[];
  language: string;
}

/**
 * Get audio duration in seconds using ffprobe
 */
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Extract a time segment from an audio file as MP3 (small, Whisper-compatible)
 */
function extractChunk(
  filePath: string,
  outputPath: string,
  startSec: number,
  durationSec: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .audioCodec('libmp3lame')
      .audioBitrate('64k')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`ffmpeg chunk failed: ${err.message}`)))
      .run();
  });
}

/**
 * STT manager using Groq Whisper API
 */
export class STTManager {
  private modelName: string;
  private progress: ProgressManager;
  private groq: Groq;

  constructor(modelName?: string, progress?: ProgressManager) {
    const config = getConfig();
    this.modelName = modelName || config.WHISPER_MODEL;
    this.progress = progress || new ProgressManager();
    this.groq = new Groq({ apiKey: config.GROQ_API_KEY });
  }

  /**
   * Send a single file to Groq and return the result
   */
  private async transcribeSingleFile(
    filePath: string,
    options: TranscribeOptions,
    timeOffset: number = 0,
  ): Promise<TranscriptionResult> {
    const response = await this.groq.audio.transcriptions.create({
      file: createReadStream(filePath),
      model: this.modelName,
      language: options.language,
      response_format: 'verbose_json',
      ...(options.task === 'translate' ? { task: 'translate' } : {}),
    }) as any;

    const segments: Segment[] = (response.segments || []).map((seg: any) => ({
      start: seg.start + timeOffset,
      end: seg.end + timeOffset,
      text: seg.text,
    }));

    return {
      text: response.text || '',
      language: response.language || 'unknown',
      segments,
    };
  }

  /**
   * Transcribe an audio file using Groq Whisper API.
   * Automatically splits large files into chunks.
   */
  async transcribeFile(filePath: string, options: TranscribeOptions = {}): Promise<TranscriptionResult> {
    const config = getConfig();
    const fileSize = statSync(filePath).size;

    if (fileSize <= MAX_FILE_SIZE) {
      // Small enough — send directly
      this.progress.info(`Running Groq Whisper API (model: ${this.modelName})...`);
      this.progress.initChunk();
      try {
        const result = await this.transcribeSingleFile(filePath, options);
        this.progress.completeChunk();
        return result;
      } catch (err) {
        this.progress.completeChunk();
        throw err;
      }
    }

    // File too large — split into chunks
    const chunkDurationSec = config.CHUNK_DURATION_MINUTES * 60;
    const totalDuration = await getAudioDuration(filePath);
    const numChunks = Math.ceil(totalDuration / chunkDurationSec);

    this.progress.info(
      `File is ${(fileSize / 1024 / 1024).toFixed(1)}MB — splitting into ${numChunks} chunks (${config.CHUNK_DURATION_MINUTES}min each)...`,
    );

    const results: TranscriptionResult[] = [];
    const tempFiles: string[] = [];

    try {
      for (let i = 0; i < numChunks; i++) {
        const startSec = i * chunkDurationSec;
        const duration = Math.min(chunkDurationSec, totalDuration - startSec);
        const tmpPath = join(tmpdir(), `mt-chunk-${randomBytes(6).toString('hex')}.mp3`);
        tempFiles.push(tmpPath);

        this.progress.info(`Chunk ${i + 1}/${numChunks}: extracting ${Math.round(startSec / 60)}m–${Math.round((startSec + duration) / 60)}m...`);
        await extractChunk(filePath, tmpPath, startSec, duration);

        this.progress.info(`Chunk ${i + 1}/${numChunks}: transcribing...`);
        this.progress.initChunk();
        try {
          const result = await this.transcribeSingleFile(tmpPath, options, startSec);
          this.progress.completeChunk();
          results.push(result);
        } catch (err: any) {
          this.progress.completeChunk();
          throw new Error(`Chunk ${i + 1}/${numChunks} failed: ${err?.message || JSON.stringify(err)}`);
        }
      }
    } finally {
      // Clean up temp files
      await Promise.all(tempFiles.map(f => unlink(f).catch(() => {})));
    }

    return this.mergeTranscripts(results);
  }

  /**
   * Merge multiple transcription results
   */
  mergeTranscripts(results: TranscriptionResult[]): TranscriptionResult {
    const mergedText = results.map(r => r.text).join(' ').replace(/\s+/g, ' ').trim();

    const mergedSegments: Segment[] = [];

    for (const result of results) {
      for (const segment of result.segments) {
        mergedSegments.push(segment);
      }
    }

    return {
      text: mergedText,
      segments: mergedSegments,
      language: results[0]?.language || 'unknown',
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    this.progress.cleanup();
  }
}
