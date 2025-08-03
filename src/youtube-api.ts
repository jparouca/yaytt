interface YouTubePlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: {
    simpleText: string;
  };
  kind?: string;
}

interface VTTCue {
  start: number;
  end: number;
  text: string;
}

export class YouTubeAPI {
  private static readonly INNERTUBE_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player';
  private static readonly FALLBACK_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
  private static readonly USER_AGENT = 'Mozilla/5.0 (Linux; Android 11; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';

  async getVideoInfo(videoId: string): Promise<YouTubePlayerResponse> {
    let apiKey: string;
    try {
      apiKey = await this.extractApiKey(videoId);
    } catch {
      apiKey = YouTubeAPI.FALLBACK_API_KEY;
    }

    const response = await fetch(`${YouTubeAPI.INNERTUBE_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20210721.00.00'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20210721.00.00'
          }
        },
        videoId: videoId
      })
    });

    if (!response.ok) {
      throw new Error(`YouTube API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async extractApiKey(videoId: string): Promise<string> {
    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': YouTubeAPI.USER_AGENT
      }
    });

    if (!videoPageResponse.ok) {
      throw new Error('Failed to fetch video page');
    }

    const html = await videoPageResponse.text();
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    
    if (!apiKeyMatch) {
      throw new Error('Could not extract API key from video page');
    }

    return apiKeyMatch[1];
  }

  async getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
    const playerResponse = await this.getVideoInfo(videoId);
    
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captionTracks || captionTracks.length === 0) {
      throw new Error(`No captions available for video: ${videoId}`);
    }

    return captionTracks;
  }

  async downloadCaptions(captionUrl: string): Promise<string> {
    const response = await fetch(`${captionUrl}&fmt=vtt`, {
      headers: {
        'User-Agent': YouTubeAPI.USER_AGENT,
        'Accept': '*/*',
        'Referer': 'https://www.youtube.com/'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download captions: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  parseVTT(vttContent: string): VTTCue[] {
    const lines = vttContent.split('\n');
    const cues: VTTCue[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.includes('-->')) {
        const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
        
        if (timeMatch) {
          const startTime = this.parseTimestamp(timeMatch[1]);
          const endTime = this.parseTimestamp(timeMatch[2]);
          
          let text = '';
          for (let j = i + 1; j < lines.length; j++) {
            const textLine = lines[j].trim();
            if (textLine === '') {
              break;
            }
            if (text) text += ' ';
            text += this.cleanCaptionText(textLine);
          }
          
          if (text) {
            cues.push({
              start: startTime,
              end: endTime,
              text: text
            });
          }
        }
      }
    }
    
    return cues;
  }

  private parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':');
    const seconds = parts[2].split('.');
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const secs = parseInt(seconds[0], 10);
    const milliseconds = parseInt(seconds[1], 10);
    
    return hours * 3600 + minutes * 60 + secs + milliseconds / 1000;
  }

  private cleanCaptionText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}