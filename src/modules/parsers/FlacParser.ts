import { BaseParser } from './BaseParser.js';
import { AudioBuffer } from '../audio.js';
import { ProgressManager } from '../progress.js';
import { ParserError } from './ParserError.js';
import { FileDecoder } from 'flac-bindings';
import { once } from 'events';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

/**
 * FLAC file constants
 */
const FLAC_SIGNATURE = 'fLaC';

/**
 * FLAC metadata block types
 */
const FLAC_METADATA_STREAMINFO = 0;
const FLAC_METADATA_PADDING = 1;
const FLAC_METADATA_APPLICATION = 2;
const FLAC_METADATA_SEEKTABLE = 3;
const FLAC_METADATA_VORBIS_COMMENT = 4;
const FLAC_METADATA_CUESHEET = 5;
const FLAC_METADATA_PICTURE = 6;

/**
 * FlacParser - Basic parser for FLAC (Free Lossless Audio Codec) files
 *
 * This is a simplified implementation that:
 * 1. Validates the "fLaC" signature
 * 2. Parses the STREAMINFO metadata block
 * 3. Provides basic frame extraction
 *
 * For full FLAC decoding support, consider using a library like 'flac-js'
 * or converting to WAV using ffmpeg.
 */
export class FlacParser extends BaseParser {
  private readonly SUPPORTED_EXTENSIONS = ['.flac'];

  /**
   * Check if this parser supports the given extension
   * @param extension - File extension
   * @returns True if extension is .flac
   */
  supports(extension: string): boolean {
    return this.supportsExtension(extension, this.SUPPORTED_EXTENSIONS);
  }

  /**
   * Get parser name
   * @returns "FLAC"
   */
  getName(): string {
    return 'FLAC';
  }

  /**
   * Get supported extensions
   * @returns Array of extensions
   */
  getExtensions(): string[] {
    return [...this.SUPPORTED_EXTENSIONS];
  }

  /**
   * Parse FLAC file buffer
   * @param buffer - FLAC file buffer
   * @param progress - Optional progress manager
   * @returns AudioBuffer
   * @throws ParserError if file is invalid or cannot be decoded
   */
  protected async parseBuffer(buffer: Buffer, progress?: ProgressManager): Promise<AudioBuffer> {
    // Validate FLAC signature
    if (buffer.length < 4 || !this.validateSignature(buffer, [0x66, 0x4c, 0x61, 0x43])) {
      throw ParserError.invalidHeader('FLAC', FLAC_SIGNATURE);
    }

    progress?.info('FLAC signature validated successfully');

    // Parse STREAMINFO metadata block (must be first)
    const streamInfo = this.parseStreamInfo(buffer, 4);
    progress?.info(`FLAC streaminfo: ${streamInfo.bitsPerSample}-bit ${streamInfo.channels}ch @ ${streamInfo.sampleRate}Hz`);

    // Use flac-bindings to decode the actual audio data
    progress?.info('Decoding FLAC audio data...');
    const audioData = await this.decodeFlacBuffer(buffer, streamInfo, progress);

    return {
      sampleRate: streamInfo.sampleRate,
      channels: streamInfo.channels,
      data: audioData,
      duration: streamInfo.totalSamples > 0 ? streamInfo.totalSamples / streamInfo.sampleRate : audioData.length / (streamInfo.sampleRate * streamInfo.channels),
    };
  }

  /**
   * Decode FLAC buffer using flac-bindings library
   * @param buffer - FLAC file buffer
   * @param streamInfo - Parsed stream info
   * @param progress - Optional progress manager
   * @returns Float32Array with audio data
   */
  private async decodeFlacBuffer(buffer: Buffer, streamInfo: {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    totalSamples: number;
  }, progress?: ProgressManager): Promise<Float32Array> {
    // Create a temporary file for the FLAC decoder
    const tempFilePath = this.getTempFilePath();

    try {
      await this.writeTempFile(tempFilePath, buffer);

      // Create decoder
      const decoder = new FileDecoder({
        file: tempFilePath,
      });

      // Collect all PCM data
      const chunks: Buffer[] = [];
      let formatReceived = false;
      let sampleRate = streamInfo.sampleRate;
      let channels = streamInfo.channels;
      let bitsPerSample = streamInfo.bitsPerSample;

      decoder.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        progress?.updateChunk((chunks.length * chunk.length) / (streamInfo.totalSamples * channels * (bitsPerSample / 8)) * 100);
      });

      decoder.on('format', (format: { sampleRate: number; channels: number; bitsPerSample: number }) => {
        sampleRate = format.sampleRate;
        channels = format.channels;
        bitsPerSample = format.bitsPerSample;
        formatReceived = true;
        progress?.info(`Audio format: ${bitsPerSample}-bit ${channels}ch @ ${sampleRate}Hz`);
      });

      // Wait for the decoder to finish
      await once(decoder, 'end');

      // Clean up temp file
      await this.deleteTempFile(tempFilePath);

      // Combine all chunks
      const totalBuffer = Buffer.concat(chunks);

      // Convert PCM buffer to Float32Array
      return this.convertPcmToFloat32(totalBuffer, bitsPerSample);
    } catch (error) {
      // Clean up temp file on error
      await this.deleteTempFile(tempFilePath).catch(() => {});
      throw new ParserError(
        `FLAC decoding failed: ${error instanceof Error ? error.message : String(error)}`,
        'DECODE_ERROR',
        'FLAC',
        { originalError: error }
      );
    }
  }

  /**
   * Convert PCM buffer to Float32Array
   * @param buffer - PCM buffer
   * @param bitsPerSample - Bits per sample (16 or 24)
   * @returns Float32Array
   */
  private convertPcmToFloat32(buffer: Buffer, bitsPerSample: number): Float32Array {
    const sampleCount = buffer.length / (bitsPerSample / 8);
    const result = new Float32Array(sampleCount);
    const maxSampleValue = Math.pow(2, bitsPerSample - 1);

    if (bitsPerSample === 16) {
      for (let i = 0; i < sampleCount; i++) {
        // Read 16-bit signed little-endian value
        const sample = buffer.readInt16LE(i * 2);
        result[i] = sample / maxSampleValue;
      }
    } else if (bitsPerSample === 24) {
      for (let i = 0; i < sampleCount; i++) {
        // Read 24-bit signed little-endian value
        const byte1 = buffer[i * 3];
        const byte2 = buffer[i * 3 + 1];
        const byte3 = buffer[i * 3 + 2];
        let sample = byte1 | (byte2 << 8) | (byte3 << 16);
        // Sign-extend for 24-bit
        if (sample & 0x800000) {
          sample |= 0xFF000000;
        }
        result[i] = sample / maxSampleValue;
      }
    } else {
      // Fallback for other bit depths (read as unsigned then convert)
      for (let i = 0; i < sampleCount; i++) {
        result[i] = (buffer[i] - 128) / 128;
      }
    }

    return result;
  }

  /**
   * Get temp file path
   * @returns Temp file path
   */
  private getTempFilePath(): string {
    const randomSuffix = randomBytes(8).toString('hex');
    return join(tmpdir(), `flac-decode-${randomSuffix}.flac`);
  }

  /**
   * Write buffer to temp file
   * @param filePath - File path
   * @param buffer - Buffer to write
   */
  private async writeTempFile(filePath: string, buffer: Buffer): Promise<void> {
    await writeFile(filePath, buffer);
  }

  /**
   * Delete temp file
   * @param filePath - File path
   */
  private async deleteTempFile(filePath: string): Promise<void> {
    await unlink(filePath).catch(() => {});
  }

  /**
   * Parse the STREAMINFO metadata block
   * @param buffer - FLAC file buffer
   * @param offset - Offset to start reading (after "fLaC" signature)
   * @returns Stream information
   * @throws ParserError if STREAMINFO block is invalid
   */
  private parseStreamInfo(buffer: Buffer, offset: number): {
    minBlockSize: number;
    maxBlockSize: number;
    minFrameSize: number;
    maxFrameSize: number;
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    totalSamples: number;
    md5: string;
  } {
    if (offset + 4 > buffer.length) {
      throw ParserError.corruptedData('FLAC', 'Buffer too small for metadata header');
    }

    const header = buffer[offset];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7F;
    const blockLength = this.readFlacUint24BE(buffer, offset + 1);

    if (blockType !== FLAC_METADATA_STREAMINFO) {
      throw new ParserError(
        `First FLAC metadata block must be STREAMINFO (0), got ${blockType}`,
        'INVALID_METADATA',
        'FLAC',
        { blockType, expected: FLAC_METADATA_STREAMINFO }
      );
    }

    if (offset + 4 + blockLength > buffer.length) {
      throw ParserError.corruptedData('FLAC', 'STREAMINFO block exceeds buffer');
    }

    const dataOffset = offset + 4;

    // Parse STREAMINFO fields (fixed 34 bytes according to spec)
    // Min block size (16 bits)
    const minBlockSize = this.readFlacUint16BE(buffer, dataOffset);

    // Max block size (16 bits)
    const maxBlockSize = this.readFlacUint16BE(buffer, dataOffset + 2);

    // Min frame size (24 bits, 0 if unknown)
    const minFrameSize = this.readFlacUint24BE(buffer, dataOffset + 4);

    // Max frame size (24 bits, 0 if unknown)
    const maxFrameSize = this.readFlacUint24BE(buffer, dataOffset + 7);

    // Sample rate, channels, bits per sample, total samples (36 bits total)
    const firstPart = this.readFlacUint32BE(buffer, dataOffset + 10);
    const secondPart = this.readUint8(buffer, dataOffset + 14);

    // Sample rate (20 bits)
    const sampleRate = ((firstPart >>> 12) & 0xFFFFF);

    // Channels (3 bits + 1) = channels 1-8
    const channels = ((firstPart >>> 9) & 0x07) + 1;

    // Bits per sample (5 bits + 1) = 4-32
    const bitsPerSample = ((firstPart >>> 4) & 0x1F) + 1;

    // Total samples in stream (36 bits)
    const totalSamples = ((firstPart & 0x0F) << 32) | (secondPart << 24) |
                        (this.readUint8(buffer, dataOffset + 15) << 16) |
                        (this.readUint8(buffer, dataOffset + 16) << 8) |
                        this.readUint8(buffer, dataOffset + 17);

    // MD5 signature (16 bytes)
    const md5 = buffer.subarray(dataOffset + 18, dataOffset + 34).toString('hex');

    return {
      minBlockSize,
      maxBlockSize,
      minFrameSize,
      maxFrameSize,
      sampleRate,
      channels,
      bitsPerSample,
      totalSamples,
      md5,
    };
  }

  /**
   * Read a single byte from buffer
   * @param buffer - Buffer to read from
   * @param offset - Offset to read from
   * @returns Byte value
   */
  private readUint8(buffer: Buffer, offset: number): number {
    return buffer[offset];
  }

  /**
   * Read a 16-bit big-endian unsigned integer (FLAC specific)
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  private readFlacUint16BE(buffer: Buffer, offset: number): number {
    return (buffer[offset] << 8) | buffer[offset + 1];
  }

  /**
   * Read a 24-bit big-endian unsigned integer (FLAC specific)
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  private readFlacUint24BE(buffer: Buffer, offset: number): number {
    return (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
  }

  /**
   * Read a 32-bit big-endian unsigned integer
   * @param buffer - Buffer to read from
   * @param offset - Offset to start reading
   * @returns Integer value
   */
  private readFlacUint32BE(buffer: Buffer, offset: number): number {
    return (buffer[offset] << 24) | (buffer[offset + 1] << 16) |
           (buffer[offset + 2] << 8) | buffer[offset + 3];
  }
}
