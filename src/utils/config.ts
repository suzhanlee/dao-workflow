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
  // Groq API Key
  GROQ_API_KEY: z.string().min(1),

  // Whisper Model Configuration
  WHISPER_MODEL: z.enum(['whisper-large-v3', 'whisper-large-v3-turbo'])
    .default('whisper-large-v3'),

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
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load configuration from environment variables
 * @returns Parsed configuration object
 */
export function loadConfig(): Config {
  const rawConfig = {
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    WHISPER_MODEL: process.env.WHISPER_MODEL || 'whisper-large-v3',
    CHUNK_DURATION_MINUTES: process.env.CHUNK_DURATION_MINUTES || '30',
    OUTPUT_DIR: process.env.OUTPUT_DIR || './transcripts',
    DEFAULT_OUTPUT_FORMAT: process.env.DEFAULT_OUTPUT_FORMAT || 'txt',
    SHOW_PROGRESS: process.env.SHOW_PROGRESS || 'true',
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
