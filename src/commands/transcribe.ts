import { Command } from 'commander';
import { writeFile, mkdir } from 'fs/promises';
import { join, basename, extname, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { hasEnvFile, getConfig, fileExists } from '../utils/config.js';
import { validateAudioFormat, getAudioMetadata, formatDuration } from '../modules/audio.js';
import { STTManager, TranscribeOptions } from '../modules/stt.js';
import { ProgressManager } from '../modules/progress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Format transcript as SRT
 */
function formatAsSRT(segments: Array<{ start: number; end: number; text: string }>): string {
  return segments
    .map((seg, i) => {
      const formatTime = (sec: number): string => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
      };
      return `${i + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

/**
 * Format transcript as VTT
 */
function formatAsVTT(segments: Array<{ start: number; end: number; text: string }>): string {
  const formatTime = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  const cues = segments
    .map(seg => `${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text.trim()}`)
    .join('\n\n');

  return `WEBVTT\n\n${cues}`;
}

/**
 * Format transcript as JSON
 */
function formatAsJSON(text: string, segments: Array<{ start: number; end: number; text: string }>, language: string): string {
  return JSON.stringify({ text, segments, language }, null, 2);
}

/**
 * Generate output file path
 */
function getOutputPath(inputPath: string, format: string, outputPath?: string): string {
  if (outputPath) return outputPath;

  const name = basename(inputPath, extname(inputPath));
  const ext = format === 'txt' ? 'txt' : format;
  const config = getConfig();

  return join(config.OUTPUT_DIR, `${name}.${ext}`);
}

/**
 * Ensure output directory exists
 */
async function ensureOutputDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Create transcribe command
 */
export const transcribeCommand = new Command('transcribe')
  .description('Transcribe audio file to text')
  .argument('<input>', 'Input audio file path (MP3, WAV, M4A, etc.)')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format (txt, srt, vtt, json)', 'txt')
  .option('-m, --model <model>', 'Whisper model to use (tiny, base, small, medium, large-v3)')
  .option('-l, --language <code>', 'Language code (ko, en, ja, etc.) - auto-detect if not specified')
  .option('-t, --translate', 'Translate to English')
  .option('--no-progress', 'Disable progress bar')
  .action(async (input, options) => {
    const progress = new ProgressManager(options.progress);

    if (!hasEnvFile()) {
      progress.warn('No .env file found. Run "meeting-transcriber init" to create one.');
    }

    const config = getConfig();
    if (!config.GROQ_API_KEY) {
      progress.error('GROQ_API_KEY is not set. Add it to your .env file: GROQ_API_KEY=gsk_xxxxx');
      process.exit(1);
    }

    if (!fileExists(input)) {
      progress.error(`Input file not found: ${input}`);
      process.exit(1);
    }

    if (!validateAudioFormat(input)) {
      progress.error('Unsupported audio format. Supported formats: wav, mp3, m4a, flac, ogg, aac, wma');
      process.exit(1);
    }

    const validFormats = ['txt', 'srt', 'vtt', 'json'];
    if (!validFormats.includes(options.format)) {
      progress.error(`Invalid format: ${options.format}. Valid formats: ${validFormats.join(', ')}`);
      process.exit(1);
    }

    const outputPath = getOutputPath(input, options.format, options.output);

    try {
      progress.info('Starting transcription...');

      const metadata = await getAudioMetadata(input);
      progress.info(`File: ${basename(input)}`);
      progress.info(`Duration: ${metadata.duration > 0 ? formatDuration(metadata.duration) : 'unknown'}`);
      progress.info(`Format: ${metadata.format.toUpperCase()}`);

      const sttOptions: TranscribeOptions = {
        language: options.language || undefined,
        task: options.translate ? 'translate' : 'transcribe',
      };

      const sttManager = new STTManager(options.model, progress);

      try {
        progress.initOverall(1);
        const result = await sttManager.transcribeFile(input, sttOptions);
        progress.updateOverall(1);
        progress.completeOverall();

        let outputContent: string;
        switch (options.format) {
          case 'srt':
            outputContent = formatAsSRT(result.segments);
            break;
          case 'vtt':
            outputContent = formatAsVTT(result.segments);
            break;
          case 'json':
            outputContent = formatAsJSON(result.text, result.segments, result.language);
            break;
          default:
            outputContent = result.text;
        }

        await ensureOutputDir(outputPath);
        await writeFile(outputPath, outputContent, 'utf-8');

        progress.success('Transcription complete!');
        console.log('');
        console.log(`Output: ${outputPath}`);
        console.log(`Character count: ${result.text.length}`);
        console.log(`Detected language: ${result.language}`);
        console.log(`Segments: ${result.segments.length}`);

        if (options.format === 'txt') {
          console.log('');
          console.log('Preview (first 200 chars):');
          console.log('─'.repeat(50));
          console.log(result.text.substring(0, 200) + (result.text.length > 200 ? '...' : ''));
          console.log('─'.repeat(50));
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        progress.error(`Transcription failed: ${msg}`);
        process.exit(1);
      } finally {
        await sttManager.dispose();
      }
    } catch (error) {
      progress.error(`Transcription failed: ${error}`);
      process.exit(1);
    } finally {
      progress.cleanup();
    }
  });
