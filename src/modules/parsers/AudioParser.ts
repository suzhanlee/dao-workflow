import { AudioBuffer } from '../audio.js';
import { ProgressManager } from '../progress.js';

/**
 * AudioParser Interface
 * Defines the contract for audio format parsers.
 * Implementations of this interface can parse specific audio formats.
 */
export interface AudioParser {
  /**
   * Parse an audio file and return an AudioBuffer
   * @param filePath - Path to the audio file
   * @param progress - Optional progress manager for status updates
   * @returns AudioBuffer containing the parsed audio data
   * @throws Error if parsing fails or file is invalid
   */
  parse(filePath: string, progress?: ProgressManager): Promise<AudioBuffer>;

  /**
   * Check if this parser supports the given file extension
   * @param extension - File extension with or without dot (e.g., ".wav" or "wav")
   * @returns True if this parser can handle the format
   */
  supports(extension: string): boolean;

  /**
   * Get the name of this parser (for logging/debugging)
   * @returns Parser name (e.g., "WAV", "FLAC")
   */
  getName(): string;

  /**
   * Get the file extensions supported by this parser
   * @returns Array of extensions with dots (e.g., [".wav"])
   */
  getExtensions(): string[];
}
