import * as cliProgress from 'cli-progress';
import { getConfig } from '../utils/config.js';

/**
 * Progress manager for tracking transcription progress
 */
export class ProgressManager {
  private overallBar: cliProgress.SingleBar | null = null;
  private chunkBar: cliProgress.SingleBar | null = null;
  private showProgress: boolean;

  constructor(showProgress?: boolean) {
    const config = getConfig();
    this.showProgress = showProgress ?? config.SHOW_PROGRESS;
  }

  /**
   * Initialize the overall progress bar
   * @param total - Total number of chunks to process
   */
  initOverall(total: number): void {
    if (!this.showProgress) return;

    if (this.overallBar) {
      this.overallBar.stop();
    }

    this.overallBar = new cliProgress.SingleBar({
      format: 'Overall Progress |{bar}| {percentage}% | {value}/{total} chunks',
      barCompleteChar: '=',
      barIncompleteChar: '-',
      hideCursor: true,
    }, cliProgress.Presets.shades_classic);

    this.overallBar.start(total, 0);
  }

  /**
   * Update the overall progress bar
   * @param increment - Number to increment by (default: 1)
   */
  updateOverall(increment: number = 1): void {
    if (!this.overallBar || !this.showProgress) return;
    this.overallBar.increment(increment);
  }

  /**
   * Complete the overall progress bar
   */
  completeOverall(): void {
    if (!this.overallBar || !this.showProgress) return;
    this.overallBar.stop();
    this.overallBar = null;
  }

  /**
   * Initialize the chunk processing progress bar
   */
  initChunk(): void {
    if (!this.showProgress) return;

    if (this.chunkBar) {
      this.chunkBar.stop();
    }

    this.chunkBar = new cliProgress.SingleBar({
      format: 'Processing Chunk |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
    }, cliProgress.Presets.shades_classic);

    this.chunkBar.start(100, 0);
  }

  /**
   * Update the chunk progress bar
   * @param percentage - Progress percentage (0-100)
   */
  updateChunk(percentage: number): void {
    if (!this.chunkBar || !this.showProgress) return;
    this.chunkBar.update(Math.min(100, Math.max(0, percentage)));
  }

  /**
   * Complete the chunk progress bar
   */
  completeChunk(): void {
    if (!this.chunkBar || !this.showProgress) return;
    this.chunkBar.stop();
    this.chunkBar = null;
  }

  /**
   * Print a status message (only if progress is disabled)
   * @param message - Message to print
   */
  status(message: string): void {
    if (this.showProgress) return;
    console.log(message);
  }

  /**
   * Print a log message above the progress bar (or to console if no bar)
   * @param message - Message to print
   */
  log(message: string): void {
    if (this.showProgress && (this.overallBar || this.chunkBar)) {
      const bar = this.overallBar ?? this.chunkBar!;
      (bar as any).log(`ℹ️  ${message}\n`);
    } else {
      console.log(`ℹ️  ${message}`);
    }
  }

  /**
   * Print a warning message
   * @param message - Warning message to print
   */
  warn(message: string): void {
    console.warn(`⚠️  ${message}`);
  }

  /**
   * Print an error message
   * @param message - Error message to print
   */
  error(message: string): void {
    console.error(`❌ ${message}`);
  }

  /**
   * Print a success message
   * @param message - Success message to print
   */
  success(message: string): void {
    console.log(`✅ ${message}`);
  }

  /**
   * Print an info message
   * @param message - Info message to print
   */
  info(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  /**
   * Clean up all progress bars
   */
  cleanup(): void {
    if (this.overallBar) {
      this.overallBar.stop();
      this.overallBar = null;
    }
    if (this.chunkBar) {
      this.chunkBar.stop();
      this.chunkBar = null;
    }
    if (this.showProgress) {
      process.stdout.write('\n');
    }
  }
}

/**
 * Simple progress tracker for non-TTY environments
 */
export class SimpleProgress {
  private current: number = 0;
  private total: number = 0;
  private lastUpdate: number = 0;

  constructor(total: number) {
    this.total = total;
  }

  /**
   * Update progress
   * @param increment - Number to increment by (default: 1)
   */
  update(increment: number = 1): void {
    this.current += increment;
    const now = Date.now();
    // Only update every 500ms to avoid spamming
    if (now - this.lastUpdate > 500) {
      const percentage = Math.round((this.current / this.total) * 100);
      console.log(`Progress: ${this.current}/${this.total} (${percentage}%)`);
      this.lastUpdate = now;
    }
  }

  /**
   * Complete progress
   */
  complete(): void {
    console.log(`Progress: ${this.total}/${this.total} (100%) - Complete!`);
  }
}
