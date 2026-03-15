import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../utils/config.js';
import { ProgressManager } from './progress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, '..', 'scripts', 'transcribe.py');

/**
 * Transcription options
 */
export interface TranscribeOptions {
  language?: string;
  task?: 'transcribe' | 'translate';
  beamSize?: number;
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
 * Detect available Python executable (python3 first, then python)
 */
async function detectPython(configPath?: string): Promise<string> {
  if (configPath) return configPath;

  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  for (const candidate of ['python3', 'python']) {
    try {
      await execFileAsync(candidate, ['--version']);
      return candidate;
    } catch {
      // try next
    }
  }

  throw new Error(
    'Python 3 is required. Install from python.org, then run: pip install faster-whisper'
  );
}

/**
 * Verify faster-whisper is installed
 */
async function checkFasterWhisper(python: string): Promise<void> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    await execFileAsync(python, ['-c', 'import faster_whisper']);
  } catch {
    throw new Error('Run: pip install faster-whisper');
  }
}

/**
 * STT manager using faster-whisper via Python subprocess
 */
export class STTManager {
  private modelName: string;
  private progress: ProgressManager;

  constructor(modelName?: string, progress?: ProgressManager) {
    const config = getConfig();
    this.modelName = modelName || config.WHISPER_MODEL;
    this.progress = progress || new ProgressManager();
  }

  /**
   * Transcribe an audio file using faster-whisper
   */
  async transcribeFile(filePath: string, options: TranscribeOptions = {}): Promise<TranscriptionResult> {
    const config = getConfig();

    const python = await detectPython(config.PYTHON_PATH || undefined);
    await checkFasterWhisper(python);

    const args = [
      SCRIPT_PATH,
      '--file', filePath,
      '--model', this.modelName,
      '--task', options.task || 'transcribe',
      '--beam-size', String(options.beamSize || 5),
    ];

    if (options.language) {
      args.push('--language', options.language);
    }

    this.progress.info(`Running faster-whisper (model: ${this.modelName})...`);
    this.progress.initChunk();

    return new Promise((resolve, reject) => {
      const child = spawn(python, args, {
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'status') {
              this.progress.log(msg.message);
            } else if (msg.type === 'transcribing') {
              this.progress.updateChunk(msg.progress);
            }
          } catch {
            stderr += line + '\n';
          }
        }
      });

      child.on('close', (code) => {
        this.progress.completeChunk();

        if (!stdout.trim()) {
          return reject(new Error(`Python process exited with no output. stderr: ${stderr}`));
        }

        let result: any;
        try {
          result = JSON.parse(stdout.trim());
        } catch {
          return reject(new Error(`Failed to parse Python output: ${stdout}`));
        }

        if (result.error) {
          return reject(new Error(result.error));
        }

        if (code !== 0) {
          return reject(new Error(`Python exited with code ${code}. stderr: ${stderr}`));
        }

        resolve({
          text: result.text || '',
          language: result.language || 'unknown',
          segments: result.segments || [],
        });
      });

      child.on('error', (err) => {
        this.progress.completeChunk();
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      });
    });
  }

  /**
   * Merge multiple transcription results
   */
  mergeTranscripts(results: TranscriptionResult[]): TranscriptionResult {
    const mergedText = results.map(r => r.text).join(' ').replace(/\s+/g, ' ').trim();

    const mergedSegments: Segment[] = [];
    let offset = 0;

    for (const result of results) {
      for (const segment of result.segments) {
        mergedSegments.push({
          start: segment.start + offset,
          end: segment.end + offset,
          text: segment.text,
        });
      }

      if (result.segments.length > 0) {
        const lastSegment = result.segments[result.segments.length - 1];
        offset = lastSegment.end;
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
