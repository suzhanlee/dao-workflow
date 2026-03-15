/**
 * ParserError - Custom error class for audio parsing errors
 * Provides structured error information for better error handling
 */
export class ParserError extends Error {
  readonly code: string;
  readonly format?: string;
  readonly details?: unknown;

  constructor(message: string, code: string, format?: string, details?: unknown) {
    super(message);
    this.name = 'ParserError';
    this.code = code;
    this.format = format;
    this.details = details;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ParserError.prototype);
  }

  /**
   * Create a file not found error
   * @param filePath - Path that was not found
   * @param format - Audio format
   * @returns ParserError
   */
  static fileNotFound(filePath: string, format?: string): ParserError {
    return new ParserError(
      `File not found: ${filePath}`,
      'FILE_NOT_FOUND',
      format
    );
  }

  /**
   * Create an invalid header error
   * @param format - Audio format
   * @param expected - Expected header
   * @param actual - Actual header found
   * @returns ParserError
   */
  static invalidHeader(format: string, expected: string, actual?: string): ParserError {
    const message = actual
      ? `Invalid ${format} header: expected '${expected}', got '${actual}'`
      : `Invalid ${format} header: expected '${expected}' not found`;
    return new ParserError(message, 'INVALID_HEADER', format, { expected, actual });
  }

  /**
   * Create an unsupported format error
   * @param format - Unsupported format
   * @param supported - Array of supported formats
   * @returns ParserError
   */
  static unsupportedFormat(format: string, supported: string[]): ParserError {
    return new ParserError(
      `Unsupported audio format: ${format}. Supported formats: ${supported.join(', ')}`,
      'UNSUPPORTED_FORMAT',
      format,
      { supported }
    );
  }

  /**
   * Create an unsupported codec error
   * @param format - Audio format
   * @param codec - Unsupported codec
   * @returns ParserError
   */
  static unsupportedCodec(format: string, codec: string): ParserError {
    return new ParserError(
      `Unsupported ${format} codec: ${codec}`,
      'UNSUPPORTED_CODEC',
      format,
      { codec }
    );
  }

  /**
   * Create a corrupted data error
   * @param format - Audio format
   * @param details - Optional details about the corruption
   * @returns ParserError
   */
  static corruptedData(format: string, details?: unknown): ParserError {
    return new ParserError(
      `Corrupted ${format} file data`,
      'CORRUPTED_DATA',
      format,
      details
    );
  }

  /**
   * Create a chunk not found error
   * @param format - Audio format
   * @param chunkName - Name of missing chunk
   * @returns ParserError
   */
  static chunkNotFound(format: string, chunkName: string): ParserError {
    return new ParserError(
      `${chunkName} chunk not found in ${format} file`,
      'CHUNK_NOT_FOUND',
      format,
      { chunk: chunkName }
    );
  }

  /**
   * Convert error to a serializable object
   * @returns Error details as plain object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      format: this.format,
      details: this.details,
    };
  }
}
