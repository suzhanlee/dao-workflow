import { BaseParser } from './BaseParser.js';
import { AudioBuffer } from '../audio.js';
import { ProgressManager } from '../progress.js';
import { ParserError } from './ParserError.js';

/**
 * WAV file constants
 */
const WAV_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WAV_WAVE_SIGNATURE = [0x57, 0x41, 0x56, 0x45]; // "WAVE"
const WAV_FMT_CHUNK_ID = 0x666d7420; // "fmt " as uint32
const WAV_DATA_CHUNK_ID = 0x64617461; // "data" as uint32
const WAV_PCM_FORMAT = 1; // PCM audio format

/**
 * WavParser - Parser for WAV (Waveform Audio File Format) files
 * Supports PCM formats with 8-bit, 16-bit, 24-bit, and 32-bit depth
 */
export class WavParser extends BaseParser {
  private readonly SUPPORTED_EXTENSIONS = ['.wav'];

  /**
   * Check if this parser supports the given extension
   * @param extension - File extension
   * @returns True if extension is .wav
   */
  supports(extension: string): boolean {
    return this.supportsExtension(extension, this.SUPPORTED_EXTENSIONS);
  }

  /**
   * Get parser name
   * @returns "WAV"
   */
  getName(): string {
    return 'WAV';
  }

  /**
   * Get supported extensions
   * @returns Array of extensions
   */
  getExtensions(): string[] {
    return [...this.SUPPORTED_EXTENSIONS];
  }

  /**
   * Parse WAV file buffer
   * @param buffer - WAV file buffer
   * @param progress - Optional progress manager
   * @returns AudioBuffer
   * @throws ParserError if file is invalid
   */
  protected async parseBuffer(buffer: Buffer, progress?: ProgressManager): Promise<AudioBuffer> {
    const view = new DataView(buffer.buffer);

    // Validate RIFF header (0x52494646 = "RIFF")
    const riffValue = view.getUint32(0, true);
    if (riffValue !== 0x52494646) {
      throw ParserError.invalidHeader('WAV', 'RIFF');
    }

    // Validate WAVE format (0x57415645 = "WAVE")
    const waveValue = view.getUint32(8, true);
    if (waveValue !== 0x57415645) {
      throw ParserError.invalidHeader('WAV', 'WAVE');
    }

    progress?.info('WAV header validated successfully');

    // Find and parse fmt chunk
    const fmtInfo = this.findFmtChunk(view, buffer.length);
    progress?.info(`WAV format: ${fmtInfo.bitsPerSample}-bit ${fmtInfo.channels}ch @ ${fmtInfo.sampleRate}Hz`);

    // Find and parse data chunk
    const audioData = this.findAndParseDataChunk(view, buffer.length, fmtInfo);

    return audioData;
  }

  /**
   * Find and parse the fmt chunk
   * @param view - DataView of the buffer
   * @param bufferLength - Total buffer length
   * @returns Format information
   * @throws ParserError if fmt chunk not found
   */
  private findFmtChunk(view: DataView, bufferLength: number): {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
    byteRate: number;
    blockAlign: number;
  } {
    let offset = 12;

    while (offset < bufferLength - 8) {
      const chunkId = view.getUint32(offset, true);
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === WAV_FMT_CHUNK_ID) {
        const audioFormat = view.getUint16(offset + 8, true);
        const channels = view.getUint16(offset + 10, true);
        const sampleRate = view.getUint32(offset + 12, true);
        const byteRate = view.getUint32(offset + 16, true);
        const blockAlign = view.getUint16(offset + 20, true);
        const bitsPerSample = view.getUint16(offset + 22, true);

        // Validate audio format (only PCM is supported)
        if (audioFormat !== WAV_PCM_FORMAT) {
          throw ParserError.unsupportedCodec('WAV', `format ${audioFormat}`);
        }

        // Validate bit depth
        if (bitsPerSample !== 8 && bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) {
          throw new ParserError(
            `Unsupported WAV bit depth: ${bitsPerSample}. Supported: 8, 16, 24, 32`,
            'UNSUPPORTED_BIT_DEPTH',
            'WAV',
            { bitsPerSample }
          );
        }

        return {
          audioFormat,
          channels,
          sampleRate,
          bitsPerSample,
          byteRate,
          blockAlign,
        };
      }

      offset += 8 + chunkSize;
    }

    throw ParserError.chunkNotFound('WAV', 'fmt');
  }

  /**
   * Find and parse the data chunk
   * @param view - DataView of the buffer
   * @param bufferLength - Total buffer length
   * @param fmtInfo - Format information from fmt chunk
   * @returns AudioBuffer
   * @throws ParserError if data chunk not found
   */
  private findAndParseDataChunk(
    view: DataView,
    bufferLength: number,
    fmtInfo: {
      channels: number;
      sampleRate: number;
      bitsPerSample: number;
      byteRate: number;
      blockAlign: number;
    }
  ): AudioBuffer {
    let offset = 12;

    while (offset < bufferLength - 8) {
      const chunkId = view.getUint32(offset, true);
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === WAV_DATA_CHUNK_ID) {
        const dataStart = offset + 8;
        const dataEnd = dataStart + chunkSize;

        // Ensure data chunk is within buffer bounds
        if (dataEnd > bufferLength) {
          throw ParserError.corruptedData('WAV', {
            reason: 'Data chunk exceeds buffer bounds',
            dataStart,
            dataEnd,
            bufferLength,
          });
        }

        // Calculate number of samples
        const bytesPerSample = fmtInfo.bitsPerSample / 8;
        const numSamples = Math.floor(chunkSize / bytesPerSample);

        // Extract audio data slice
        const dataBuffer = Buffer.from(bufferLength - dataStart > chunkSize
          ? new Uint8Array(view.buffer, dataStart, chunkSize)
          : new Uint8Array(view.buffer, dataStart)
        );

        // Normalize to Float32Array (-1.0 to 1.0)
        const data = this.normalizeToFloat32(dataBuffer.slice(0, chunkSize), fmtInfo.bitsPerSample);

        return {
          sampleRate: fmtInfo.sampleRate,
          channels: fmtInfo.channels,
          data,
          duration: numSamples / (fmtInfo.sampleRate * fmtInfo.channels),
        };
      }

      offset += 8 + chunkSize;
    }

    throw ParserError.chunkNotFound('WAV', 'data');
  }
}
