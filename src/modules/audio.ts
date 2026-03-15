import { readFile, writeFile, unlink } from 'fs/promises';
import { extname, basename, join } from 'path';
import { tmpdir } from 'os';
import { getConfig } from '../utils/config.js';
import { ProgressManager } from './progress.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ParserRegistry } from './parsers/ParserRegistry.js';
import { WavParser } from './parsers/WavParser.js';
import { FlacParser } from './parsers/FlacParser.js';
import ffmpeg from 'fluent-ffmpeg';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

// Initialize and register audio parsers
const registry = ParserRegistry.getInstance();
registry.registerParser(new WavParser());
registry.registerParser(new FlacParser());

/**
 * Audio buffer interface
 */
export interface AudioBuffer {
  sampleRate: number;
  channels: number;
  data: Float32Array;
  duration: number; // in seconds
}

/**
 * Audio chunk interface
 */
export interface AudioChunk {
  index: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  buffer: Float32Array;
}

/**
 * Audio metadata interface
 */
export interface AudioMetadata {
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  format: string;
  size: number; // in bytes
}

/**
 * Validate audio file format
 * Uses the ParserRegistry to check if a parser is available for the format
 * @param filePath - Path to the audio file
 * @returns True if format is supported
 */
export function validateAudioFormat(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return registry.isFormatSupported(ext);
}

/**
 * Get supported audio formats from the registry
 * @returns Array of supported file extensions
 */
export function getSupportedFormats(): string[] {
  return registry.getSupportedFormats();
}

/**
 * Get audio file format
 * @param filePath - Path to the audio file
 * @returns File extension without dot
 */
export function getAudioFormat(filePath: string): string {
  return extname(filePath).toLowerCase().slice(1);
}

/**
 * Convert audio file to WAV format using ffmpeg
 * @param filePath - Path to the source audio file
 * @param progress - Optional progress manager
 * @returns Path to the converted WAV file
 */
async function convertToWav(filePath: string, progress?: ProgressManager): Promise<string> {
  const randomSuffix = randomBytes(8).toString('hex');
  const wavPath = join(tmpdir(), `meeting-transcriber-${randomSuffix}.wav`);

  progress?.info(`Converting ${basename(filePath)} to WAV...`);

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(wavPath)
      .on('progress', (p) => {
        if (p.percent) {
          progress?.updateChunk(p.percent);
        }
      })
      .on('end', () => {
        progress?.success('Conversion complete');
        resolve(wavPath);
      })
      .on('error', (err) => {
        reject(new Error(`ffmpeg conversion failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Load audio file using the appropriate parser from the registry
 * Automatically converts non-WAV formats to WAV if needed
 * @param filePath - Path to the audio file
 * @param progress - Optional progress manager
 * @returns AudioBuffer
 */
export async function loadAudio(filePath: string, progress?: ProgressManager): Promise<AudioBuffer> {
  const format = getAudioFormat(filePath);

  progress?.info(`Loading audio file: ${basename(filePath)} (${format})`);

  // Try to parse directly if format is supported
  if (validateAudioFormat(filePath)) {
    try {
      const parser = registry.getParser(format);
      const buffer = await parser.parse(filePath, progress);
      return buffer;
    } catch (error) {
      // If parsing fails, fall through to conversion
      if (error instanceof Error) {
        progress?.warn(`Direct parsing failed: ${error.message}. Attempting conversion...`);
      }
    }
  }

  // Convert to WAV and parse
  const wavPath = await convertToWav(filePath, progress);

  try {
    const wavParser = registry.getParser('wav');
    progress?.info(`Parsing converted WAV file...`);
    const buffer = await wavParser.parse(wavPath, progress);
    return buffer;
  } finally {
    // Clean up converted file
    await unlink(wavPath).catch(() => {});
  }
}

/**
 * Split audio into chunks of specified duration
 * @param audio - AudioBuffer to split
 * @param chunkDurationSec - Duration of each chunk in seconds
 * @returns Array of AudioChunks
 */
export function splitAudio(audio: AudioBuffer, chunkDurationSec: number): AudioChunk[] {
  const chunkSampleCount = Math.floor(chunkDurationSec * audio.sampleRate);
  const totalChunks = Math.ceil(audio.data.length / chunkSampleCount);
  const chunks: AudioChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startSample = i * chunkSampleCount;
    const endSample = Math.min(startSample + chunkSampleCount, audio.data.length);
    const chunkLength = endSample - startSample;

    const chunk: AudioChunk = {
      index: i,
      startTime: startSample / audio.sampleRate,
      endTime: endSample / audio.sampleRate,
      buffer: audio.data.slice(startSample, endSample),
    };

    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Split audio based on config settings
 * @param audio - AudioBuffer to split
 * @param progress - Optional progress manager
 * @returns Array of AudioChunks
 */
export function splitAudioByConfig(audio: AudioBuffer, progress?: ProgressManager): AudioChunk[] {
  const config = getConfig();
  const chunkDurationSec = config.CHUNK_DURATION_MINUTES * 60;

  progress?.info(`Chunk duration: ${config.CHUNK_DURATION_MINUTES} minutes`);

  const chunks = splitAudio(audio, chunkDurationSec);
  progress?.success(`Split into ${chunks.length} chunks`);

  return chunks;
}

/**
 * Get audio file metadata
 * @param filePath - Path to the audio file
 * @returns AudioMetadata
 */
export async function getAudioMetadata(filePath: string): Promise<AudioMetadata> {
  const stats = await readFile(filePath);
  const format = getAudioFormat(filePath);

  // Try to get actual metadata using the parser if available
  if (registry.isFormatSupported(format)) {
    try {
      const parser = registry.getParser(format);
      const buffer = await parser.parse(filePath);
      return {
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.channels,
        format,
        size: stats.length,
      };
    } catch {
      // Fall back to basic info on parse error
    }
  }

  // Basic metadata for non-parseable files
  return {
    duration: 0, // Unknown
    sampleRate: 16000, // Default assumption
    channels: 1, // Default assumption
    format,
    size: stats.length,
  };
}

/**
 * Convert buffer to 16kHz mono format for Whisper
 * @param buffer - AudioBuffer to convert
 * @returns AudioBuffer at 16kHz mono
 */
export function normalizeForWhisper(buffer: AudioBuffer): AudioBuffer {
  const targetSampleRate = 16000;
  const targetChannels = 1;

  // Resample if needed
  let data: Float32Array;

  if (buffer.sampleRate === targetSampleRate) {
    data = buffer.data;
  } else {
    // Simple linear interpolation for resampling
    const ratio = buffer.sampleRate / targetSampleRate;
    const newLength = Math.floor(buffer.data.length / ratio);
    data = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.ceil(srcIndex);
      const fraction = srcIndex - srcIndexFloor;

      if (srcIndexCeil >= buffer.data.length) {
        data[i] = buffer.data[srcIndexFloor];
      } else {
        data[i] = buffer.data[srcIndexFloor] * (1 - fraction) +
                  buffer.data[srcIndexCeil] * fraction;
      }
    }
  }

  // Convert to mono if needed
  if (buffer.channels === 1) {
    return {
      sampleRate: targetSampleRate,
      channels: 1,
      data,
      duration: data.length / targetSampleRate,
    };
  }

  // Mix channels to mono (average)
  const monoData = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    for (let ch = 0; ch < buffer.channels; ch++) {
      const channelIndex = i * buffer.channels + ch;
      if (channelIndex < buffer.data.length) {
        sum += buffer.data[channelIndex];
      }
    }
    monoData[i] = sum / buffer.channels;
  }

  return {
    sampleRate: targetSampleRate,
    channels: 1,
    data: monoData,
    duration: monoData.length / targetSampleRate,
  };
}

/**
 * Format duration in human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1h 30m 15s")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
