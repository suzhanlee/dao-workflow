import { AudioParser } from './AudioParser.js';
import { ParserError } from './ParserError.js';

/**
 * ParserRegistry - Factory and registry for audio format parsers
 * Manages available parsers and provides the appropriate parser for a given format
 */
export class ParserRegistry {
  private static instance: ParserRegistry;
  private parsers: Map<string, AudioParser> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance of ParserRegistry
   * @returns ParserRegistry instance
   */
  static getInstance(): ParserRegistry {
    if (!ParserRegistry.instance) {
      ParserRegistry.instance = new ParserRegistry();
    }
    return ParserRegistry.instance;
  }

  /**
   * Register a parser for a specific format
   * @param parser - The parser to register
   * @throws Error if a parser with the same name already exists
   */
  registerParser(parser: AudioParser): void {
    const name = parser.getName().toLowerCase();

    if (this.parsers.has(name)) {
      throw new Error(`Parser '${name}' is already registered`);
    }

    this.parsers.set(name, parser);
  }

  /**
   * Unregister a parser by name
   * @param name - Name of the parser to unregister
   * @returns True if parser was found and removed
   */
  unregisterParser(name: string): boolean {
    return this.parsers.delete(name.toLowerCase());
  }

  /**
   * Get a parser for the given file extension
   * @param extension - File extension with or without dot (e.g., ".wav" or "wav")
   * @returns Appropriate parser for the format
   * @throws ParserError if no parser supports the format
   */
  getParser(extension: string): AudioParser {
    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;

    for (const parser of this.parsers.values()) {
      if (parser.supports(normalizedExt)) {
        return parser;
      }
    }

    const supported = this.getSupportedFormats().join(', ');
    throw new ParserError(
      `No parser available for format '${extension}'. Supported formats: ${supported}`,
      'UNSUPPORTED_FORMAT'
    );
  }

  /**
   * Get a parser by name
   * @param name - Name of the parser (e.g., "WAV", "FLAC")
   * @returns Parser with the given name
   * @throws ParserError if parser not found
   */
  getParserByName(name: string): AudioParser {
    const parser = this.parsers.get(name.toLowerCase());

    if (!parser) {
      throw new ParserError(
        `Parser '${name}' not found. Available parsers: ${this.getParserNames().join(', ')}`,
        'PARSER_NOT_FOUND'
      );
    }

    return parser;
  }

  /**
   * Check if a format is supported
   * @param extension - File extension with or without dot
   * @returns True if format is supported
   */
  isFormatSupported(extension: string): boolean {
    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;

    for (const parser of this.parsers.values()) {
      if (parser.supports(normalizedExt)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all supported file extensions
   * @returns Array of extensions with dots (e.g., [".wav", ".flac"])
   */
  getSupportedFormats(): string[] {
    const formats = new Set<string>();

    for (const parser of this.parsers.values()) {
      for (const ext of parser.getExtensions()) {
        formats.add(ext);
      }
    }

    return Array.from(formats).sort();
  }

  /**
   * Get all registered parser names
   * @returns Array of parser names
   */
  getParserNames(): string[] {
    return Array.from(this.parsers.keys()).sort();
  }

  /**
   * Get the count of registered parsers
   * @returns Number of parsers
   */
  getParserCount(): number {
    return this.parsers.size;
  }

  /**
   * Clear all registered parsers
   * Useful for testing or resetting state
   */
  clear(): void {
    this.parsers.clear();
  }

  /**
   * Get all registered parsers
   * @returns Array of all parsers
   */
  getAllParsers(): AudioParser[] {
    return Array.from(this.parsers.values());
  }
}

// Export singleton instance getter for convenience
export const getParserRegistry = ParserRegistry.getInstance.bind(ParserRegistry);
