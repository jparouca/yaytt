import { YouTubeAPI } from './youtube-api.js';
import { CaptionDeduplicator } from './deduplicator.js';
import { Caption, CaptionOptions, ExtractorConfig, CaptionExtractionError } from './types.js';

export class YouTubeCaptionExtractor {
  private rateLimiter = new Map<string, number>();
  private config: ExtractorConfig;
  private youtubeAPI: YouTubeAPI;

  constructor(config: ExtractorConfig = {}) {
    this.config = {
      userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G973F) AppleWebKit/537.36',
      timeout: 15000,
      rateLimitDelay: 3000,
      ...config
    };
    this.youtubeAPI = new YouTubeAPI();
  }

  async extractCaptions(videoId: string, options: CaptionOptions = {}): Promise<Caption[]> {
    const { lang = 'pt', retries = 3, deduplicate = true, deduplicationOptions = {} } = options;
    
    if (this.isRateLimited(videoId)) {
      throw new CaptionExtractionError(
        'Rate limited. Please try again later.',
        videoId
      );
    }

    this.updateRateLimit(videoId);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const captionTracks = await this.youtubeAPI.getCaptionTracks(videoId);
        
        let selectedTrack = captionTracks.find(track => track.languageCode === lang);
        
        if (!selectedTrack && captionTracks.length > 0) {
          const availableLanguages = captionTracks.map(track => track.languageCode).join(', ');
          
          const fallbackLanguages = ['en', 'pt-BR', 'pt', 'es'];
          for (const fallbackLang of fallbackLanguages) {
            selectedTrack = captionTracks.find(track => track.languageCode === fallbackLang);
            if (selectedTrack) break;
          }
          
          if (!selectedTrack) {
            throw new CaptionExtractionError(
              `No captions found for language '${lang}'. Available languages: ${availableLanguages}`,
              videoId
            );
          }
        }

        if (!selectedTrack) {
          throw new CaptionExtractionError(
            `No caption tracks found for video: ${videoId}`,
            videoId
          );
        }

        const vttContent = await this.youtubeAPI.downloadCaptions(selectedTrack.baseUrl);
        const cues = this.youtubeAPI.parseVTT(vttContent);
        
        let captions = cues.map(cue => ({
          start: cue.start,
          dur: cue.end - cue.start,
          text: cue.text
        }));

        if (deduplicate) {
          const deduplicator = new CaptionDeduplicator({
            enabled: true,
            ...deduplicationOptions
          });
          captions = deduplicator.deduplicate(captions);
        }

        return captions;

      } catch (error) {
        if (attempt === retries) {
          throw new CaptionExtractionError(
            `Failed to extract captions after ${retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
            videoId,
            error instanceof Error ? error : undefined
          );
        }
        
        await this.delay(1000 * attempt);
      }
    }

    throw new CaptionExtractionError('Failed to extract captions', videoId);
  }

  async extractCaptionsFromUrl(url: string, options: CaptionOptions = {}): Promise<Caption[]> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new CaptionExtractionError('Invalid YouTube URL provided');
    }
    
    return this.extractCaptions(videoId, options);
  }

  async getAvailableLanguages(videoId: string): Promise<Array<{code: string, name: string, isAutomatic: boolean}>> {
    try {
      const captionTracks = await this.youtubeAPI.getCaptionTracks(videoId);
      return captionTracks.map(track => ({
        code: track.languageCode,
        name: track.name.simpleText,
        isAutomatic: track.kind === 'asr'
      }));
    } catch (error) {
      throw new CaptionExtractionError(
        `Failed to get available languages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        videoId,
        error instanceof Error ? error : undefined
      );
    }
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^&\n?#]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // If it's already just a video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return url;
    }

    return null;
  }

  private isRateLimited(videoId: string): boolean {
    const lastRequest = this.rateLimiter.get(videoId);
    const now = Date.now();
    return lastRequest ? now - lastRequest < this.config.rateLimitDelay! : false;
  }

  private updateRateLimit(videoId: string): void {
    this.rateLimiter.set(videoId, Date.now());
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearRateLimit(videoId?: string): void {
    if (videoId) {
      this.rateLimiter.delete(videoId);
    } else {
      this.rateLimiter.clear();
    }
  }
}