#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { transcribeCommand } from './commands/transcribe.js';

// Create CLI program
const program = new Command();

program
  .name('meeting-transcriber')
  .description('CLI tool for automatic meeting transcription using STT')
  .version('1.0.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(transcribeCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
