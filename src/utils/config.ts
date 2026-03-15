import dotenv from 'dotenv';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
const projectRoot = join(__dirname, '..', '..');
dotenv.config({ path: join(projectRoot, '.env') });

// Configuration Schema with Zod
const configSchema = z.object({
  // Whisper Model Configuration
  WHISPER_MODEL: z.enum(['tiny', 'base', 'base.en', 'small', 'small.en', 'medium', 'medium.en', 'large-v1', 'large-v2', 'large-v3', 'large'])
    .default('large-v3'),

  // Audio Processing Configuration
  CHUNK_DURATION_MINUTES: z.string().transform(Number)
    .pipe(z.number().min(1).max(120))
    .default('30'),

  // Output Configuration
  OUTPUT_DIR: z.string().default('./transcripts'),
  DEFAULT_OUTPUT_FORMAT: z.enum(['txt', 'srt', 'vtt', 'json']).default('txt'),

  // Progress Bar Configuration
  SHOW_PROGRESS: z.string().transform(val => val.toLowerCase() === 'true')
    .default('true'),

  // Python executable path (empty = auto-detect python3/python)
  PYTHON_PATH: z.string().default(''),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load configuration from environment variables
 * @returns Parsed configuration object
 */
export function loadConfig(): Config {
  const rawConfig = {
    WHISPER_MODEL: process.env.WHISPER_MODEL || 'large-v3',
    CHUNK_DURATION_MINUTES: process.env.CHUNK_DURATION_MINUTES || '30',
    OUTPUT_DIR: process.env.OUTPUT_DIR || './transcripts',
    DEFAULT_OUTPUT_FORMAT: process.env.DEFAULT_OUTPUT_FORMAT || 'txt',
    SHOW_PROGRESS: process.env.SHOW_PROGRESS || 'true',
    PYTHON_PATH: process.env.PYTHON_PATH || '',
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation error:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Failed to load configuration. Please check your .env file.');
  }
}

/**
 * Check if .env file exists
 * @returns True if .env file exists
 */
export function hasEnvFile(): boolean {
  return existsSync(join(projectRoot, '.env'));
}

/**
 * Get the project root directory
 * @returns Absolute path to project root
 */
export function getProjectRoot(): string {
  return projectRoot;
}

/**
 * Validate audio file format
 * @param filePath - Path to the audio file
 * @returns True if file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

// Singleton instance
let cachedConfig: Config | null = null;

/**
 * Get cached configuration or load if not cached
 * @returns Configuration object
 */
export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}
