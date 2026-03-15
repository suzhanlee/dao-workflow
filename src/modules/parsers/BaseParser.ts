import { AudioParser } from './AudioParser.js';
import { AudioBuffer } from '../audio.js';
import { ProgressManager } from '../progress.js';
import { readFile } from 'fs/promises';
import { basename } from 'path';

/**
 * BaseParser - Abstract class providing common functionality for audio parsers
 * Reduces code duplication across different format parsers
 */
export abstract class BaseParser implements AudioParser {
  /**
   * Parse an audio file with common setup and validation
   * @param filePath - Path to the audio file
   * @param progress - Optional progress manager
   * @returns AudioBuffer from subclass implementation
   */
  async parse(filePath: string, progress?: ProgressManager): Promise<AudioBuffer> {
    progress?.info(`Parsing ${this.getName()} file: ${basename(filePath)}`);

    const buffer = await readFile(filePath);
    const result = await this.parseBuffer(buffer, progress);

    progress?.success(`Parsed ${this.getName()}: ${result.sampleRate}Hz, ${result.channels}ch, ${result.duration.toFixed(2)}s`);
    return result;
  }

  /**
   * Parse a buffer - must be implemented by subclasses
   * @param buffer - File buffer to parse
   * @param progress - Optional progress manager
   * @returns Parsed AudioBuffer
   */
  protected abstract parseBuffer(buffer: Buffer, progress?: ProgressManager): Promise<AudioBuffer>;

  /**
   * Validate that buffer starts with expected signature bytes
   * @param buffer - Buffer to check
   * @param signature - Array of expected byte values
   * @param offset - Offset to start checking (default: 0)
   * @returns True if signature matches
   */
  protected validateSignature(buffer: Buffer, signature: number[], offset: number = 0): boolean {
    if (buffer.length < offset + signature.length) {
      return false;
    }
    for (let i = 0; i < signature.length; i++) {
      if (buffer[offset + i] !== signature[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Read a 32-bit little-endian integer from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  protected readInt32LE(buffer: Buffer, offset: number): number {
    return buffer.readInt32LE(offset);
  }

  /**
   * Read a 32-bit little-endian unsigned integer from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  protected readUint32LE(buffer: Buffer, offset: number): number {
    return buffer.readUInt32LE(offset);
  }

  /**
   * Read a 16-bit little-endian integer from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  protected readInt16LE(buffer: Buffer, offset: number): number {
    return buffer.readInt16LE(offset);
  }

  /**
   * Read a 16-bit little-endian unsigned integer from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  protected readUint16LE(buffer: Buffer, offset: number): number {
    return buffer.readUInt16LE(offset);
  }

  /**
   * Read a 32-bit big-endian unsigned integer from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  protected readUint32BE(buffer: Buffer, offset: number): number {
    return buffer.readUInt32BE(offset);
  }

  /**
   * Read a 24-bit big-endian unsigned integer from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  protected readUint24BE(buffer: Buffer, offset: number): number {
    return (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
  }

  /**
   * Read a 16-bit big-endian unsigned integer from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  protected readUint16BE(buffer: Buffer, offset: number): number {
    return buffer.readUInt16BE(offset);
  }

  /**
   * Read a null-terminated string from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @param maxLength - Maximum string length
   * @returns String value
   */
  protected readString(buffer: Buffer, offset: number, maxLength: number = 4): string {
    const end = Math.min(offset + maxLength, buffer.length);
    let str = '';
    for (let i = offset; i < end; i++) {
      if (buffer[i] === 0) break;
      str += String.fromCharCode(buffer[i]);
    }
    return str;
  }

  /**
   * Check if extension matches any of the supported extensions
   * @param extension - Extension to check
   * @param extensions - Array of supported extensions
   * @returns True if supported
   */
  protected supportsExtension(extension: string, extensions: string[]): boolean {
    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;
    return extensions.some(ext => ext.toLowerCase() === normalizedExt.toLowerCase());
  }

  /**
   * Normalize audio sample values to Float32Array (-1.0 to 1.0)
   * @param buffer - Raw audio buffer
   * @param bitsPerSample - Bit depth of the audio (8, 16, 24, or 32)
   * @returns Normalized Float32Array
   */
  protected normalizeToFloat32(buffer: Buffer, bitsPerSample: number): Float32Array {
    const numSamples = (buffer.length * 8) / bitsPerSample;
    const data = new Float32Array(numSamples);

    switch (bitsPerSample) {
      case 8:
        // 8-bit unsigned: 0-255 -> -1.0 to 1.0
        for (let i = 0; i < numSamples; i++) {
          data[i] = (buffer[i] - 128) / 128.0;
        }
        break;

      case 16: {
        // 16-bit signed: -32768 to 32767 -> -1.0 to 1.0
        const view = new Int16Array(buffer.buffer, buffer.byteOffset, numSamples);
        for (let i = 0; i < numSamples; i++) {
          data[i] = view[i] / 32768.0;
        }
        break;
      }

      case 24: {
        // 24-bit signed: treat as 32-bit with scaling
        for (let i = 0; i < numSamples; i++) {
          const offset = i * 3;
          const value = (buffer[offset] << 8) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 24);
          data[i] = value / 2147483648.0;
        }
        break;
      }

      case 32: {
        // 32-bit signed: -2147483648 to 2147483647 -> -1.0 to 1.0
        const view = new Int32Array(buffer.buffer, buffer.byteOffset, numSamples);
        for (let i = 0; i < numSamples; i++) {
          data[i] = view[i] / 2147483648.0;
        }
        break;
      }

      default:
        throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
    }

    return data;
  }

  /**
   * Mix multi-channel audio to mono
   * @param data - Multi-channel audio data
   * @param channels - Number of channels
   * @returns Mono audio data
   */
  protected mixToMono(data: Float32Array, channels: number): Float32Array {
    if (channels === 1) {
      return data;
    }

    const monoLength = Math.floor(data.length / channels);
    const monoData = new Float32Array(monoLength);

    for (let i = 0; i < monoLength; i++) {
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        const channelIndex = i * channels + ch;
        if (channelIndex < data.length) {
          sum += data[channelIndex];
        }
      }
      monoData[i] = sum / channels;
    }

    return monoData;
  }

  /**
   * Create AudioBuffer from parsed components
   * @param data - Audio data as Float32Array
   * @param sampleRate - Sample rate in Hz
   * @param channels - Number of channels
   * @returns AudioBuffer
   */
  protected createAudioBuffer(data: Float32Array, sampleRate: number, channels: number): AudioBuffer {
    return {
      sampleRate,
      channels,
      data,
      duration: data.length / (sampleRate * channels),
    };
  }

  // Abstract methods that must be implemented by subclasses
  abstract supports(extension: string): boolean;
  abstract getName(): string;
  abstract getExtensions(): string[];
}
