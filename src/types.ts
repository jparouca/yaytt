export interface Caption {
  start: number;
  dur: number;
  text: string;
}

export interface CaptionOptions {
  lang?: string;
  retries?: number;
  fallback?: boolean;
  deduplicate?: boolean;
  deduplicationOptions?: {
    timeThreshold?: number;
    similarityThreshold?: number;
    mergePartialMatches?: boolean;
    aggressiveMode?: boolean;
  };
}

export interface ExtractorConfig {
  userAgent?: string;
  timeout?: number;
  rateLimitDelay?: number;
}

export class CaptionExtractionError extends Error {
  constructor(message: string, public videoId?: string, public originalError?: Error) {
    super(message);
    this.name = 'CaptionExtractionError';
  }
}