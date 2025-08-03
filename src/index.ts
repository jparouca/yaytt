import { YouTubeCaptionExtractor } from './extractor.js';

export { YouTubeCaptionExtractor } from './extractor.js';
export { Caption, CaptionOptions, ExtractorConfig, CaptionExtractionError } from './types.js';
export type * from './types.js';

export async function extractCaptions(videoIdOrUrl: string, options?: { 
  lang?: string;
  deduplicate?: boolean;
  deduplicationOptions?: {
    timeThreshold?: number;
    similarityThreshold?: number;
    mergePartialMatches?: boolean;
    aggressiveMode?: boolean;
  };
}) {
  const extractor = new YouTubeCaptionExtractor();
  
  if (videoIdOrUrl.includes('youtube.com') || videoIdOrUrl.includes('youtu.be')) {
    return extractor.extractCaptionsFromUrl(videoIdOrUrl, options);
  } else {
    return extractor.extractCaptions(videoIdOrUrl, options);
  }
}

export async function getAvailableLanguages(videoIdOrUrl: string) {
  const extractor = new YouTubeCaptionExtractor();
  
  let videoId = videoIdOrUrl;
  if (videoIdOrUrl.includes('youtube.com') || videoIdOrUrl.includes('youtu.be')) {
    const urlMatch = videoIdOrUrl.match(/(?:v=|\/|^)([a-zA-Z0-9_-]{11})/);
    videoId = urlMatch ? urlMatch[1] : videoIdOrUrl;
  }
  
  return extractor.getAvailableLanguages(videoId);
}