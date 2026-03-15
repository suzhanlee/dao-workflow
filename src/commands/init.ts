import { Command } from 'commander';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

/**
 * Default .env template
 */
const ENV_TEMPLATE = `# Prerequisites: pip install faster-whisper

# Whisper Model Configuration
# Available models: tiny, base, small, medium, large-v3
# tiny - fastest, lowest accuracy
# base - good balance
# small - better accuracy
# medium - high accuracy
# large-v3 - best accuracy, slowest
WHISPER_MODEL=base

# Output Configuration
# Directory where transcripts will be saved
OUTPUT_DIR=./transcripts

# Default output format (txt, srt, vtt, json)
DEFAULT_OUTPUT_FORMAT=txt

# Progress Bar Configuration
# Set to false to disable progress bars
SHOW_PROGRESS=true

# Python executable path (optional)
# Leave empty to auto-detect (tries python3 then python)
# Example: PYTHON_PATH=C:\\Python311\\python.exe
PYTHON_PATH=
`;

/**
 * Create init command
 */
export const initCommand = new Command('init')
  .description('Initialize configuration')
  .option('-f, --force', 'Overwrite existing .env file')
  .option('-m, --model <model>', 'Set default model (tiny, base, small, medium, large-v3)')
  .action(async (options) => {
    const envPath = join(projectRoot, '.env');

    if (existsSync(envPath) && !options.force) {
      console.log('⚠️  .env file already exists.');
      console.log('   Use --force to overwrite it.');
      console.log('   Or edit the existing .env file directly.');
      return;
    }

    let envContent = ENV_TEMPLATE;

    // Apply model option if provided
    if (options.model) {
      const validModels = ['tiny', 'base', 'base.en', 'small', 'small.en', 'medium', 'medium.en', 'large-v1', 'large-v2', 'large-v3', 'large'];
      if (!validModels.includes(options.model)) {
        console.error(`❌ Invalid model: ${options.model}`);
        console.error(`   Valid models: ${validModels.join(', ')}`);
        process.exit(1);
      }
      envContent = envContent.replace('WHISPER_MODEL=base', `WHISPER_MODEL=${options.model}`);
    }

    try {
      await writeFile(envPath, envContent, 'utf-8');
      console.log('✅ Configuration initialized successfully!');
      console.log(`   Created: ${envPath}`);
      console.log('');
      console.log('You can now run:');
      console.log('  meeting-transcriber transcribe <audio-file>');
    } catch (error) {
      console.error('❌ Failed to create .env file:', error);
      process.exit(1);
    }
  });
