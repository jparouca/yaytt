# YAYTT - Yet Another Youtube Transcriptor

[![npm version](https://badge.fury.io/js/yaytt.svg)](https://badge.fury.io/js/yaytt)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## Features

- **Smart deduplication** - Removes overlapping auto-generated caption segments
- **TypeScript support** - Full type definitions included
- **Zero dependencies** - Lightweight and self-contained

## Installation

```bash
npm install ytce
```

```bash
yarn add ytce
```

```bash
pnpm add ytce
```

## Quick Start

```typescript
import { extractCaptions } from "ytce";

const captions = await extractCaptions("WcBA3QEXJ2o");

const englishCaptions = await extractCaptions("WcBA3QEXJ2o", { lang: "en" });

const captions = await extractCaptions(
  "https://www.youtube.com/watch?v=WcBA3QEXJ2o",
);
```

## Advanced Usage

### Ultra-aggressive deduplication for heavily overlapping captions

```typescript
import { extractCaptions } from "ytce";

const cleanCaptions = await extractCaptions("WcBA3QEXJ2o", {
  deduplicationOptions: {
    aggressiveMode: true, // Maximum deduplication
  },
});
```

### Check available languages

```typescript
import { getAvailableLanguages } from "ytce";

const languages = await getAvailableLanguages("WcBA3QEXJ2o");
console.log(languages);
// [{ code: 'pt', name: 'Portuguese (auto-generated)', isAutomatic: true }]
```

### Full configuration

```typescript
import { YouTubeCaptionExtractor } from "ytce";

const extractor = new YouTubeCaptionExtractor({
  userAgent: "MyApp/1.0",
  timeout: 15000,
  rateLimitDelay: 3000,
});

const captions = await extractor.extractCaptions("WcBA3QEXJ2o", {
  lang: "pt",
  retries: 3,
  deduplicate: true,
  deduplicationOptions: {
    timeThreshold: 3, // Seconds
    similarityThreshold: 0.8, // 80% similarity
    mergePartialMatches: true,
    aggressiveMode: false, // Set to true for maximum deduplication
  },
});
```

## Command Line Interface

```bash
# Basic usage
npx ytce WcBA3QEXJ2o

# With ultra-aggressive deduplication
npx ytce WcBA3QEXJ2o --aggressive

# Using URLs
npx ytce "https://www.youtube.com/watch?v=WcBA3QEXJ2o"
```

## API Reference

### `extractCaptions(videoIdOrUrl, options?)`

Extract captions from a YouTube video.

**Parameters:**

- `videoIdOrUrl` (string): YouTube video ID or full URL
- `options` (object, optional):
  - `lang` (string): Language code (default: 'pt' for Portuguese)
  - `deduplicate` (boolean): Enable deduplication (default: true)
  - `deduplicationOptions` (object): Deduplication settings

**Returns:** `Promise<Caption[]>`

### `getAvailableLanguages(videoIdOrUrl)`

Get all available caption languages for a video.

**Parameters:**

- `videoIdOrUrl` (string): YouTube video ID or full URL

**Returns:** `Promise<{ code: string, name: string, isAutomatic: boolean }[]>`

### Types

```typescript
interface Caption {
  start: number; // Start time in seconds
  dur: number; // Duration in seconds
  text: string; // Caption text
}

interface CaptionOptions {
  lang?: string;
  retries?: number;
  fallback?: boolean;
  deduplicate?: boolean;
  deduplicationOptions?: {
    timeThreshold?: number; // Default: 3 seconds
    similarityThreshold?: number; // Default: 0.8 (80% similarity)
    mergePartialMatches?: boolean; // Default: true
    aggressiveMode?: boolean; // Default: false
  };
}
```

## Deduplication

YouTube's auto-generated captions often contain overlapping segments:

```
Before:
[0:00] [Música]
[0:00] [Música] O podcast que você ouve agora é uma
[0:02] O podcast que você ouve agora é uma
[0:02] O podcast que você ouve agora é uma produção da Central 3.

After:
[0:02] O podcast que você ouve agora é uma produção da Central 3.
```

**Results:**

- Normal mode: ~50% reduction in caption count
- Aggressive mode: ~70% reduction for heavily overlapping content

## How It Works

1. Extracts API keys from YouTube video pages
2. Calls YouTube's Innertube API directly (same API used by youtube.com)
3. Fetches caption track URLs from video metadata
4. Downloads VTT caption files directly from YouTube's servers
5. Parses timestamps and text into a clean format
6. Applies smart deduplication to remove overlapping segments

## Requirements

- Node.js 16+ or compatible runtime
- Server-side only (not for browser use due to CORS)

## Error Handling

```typescript
import { extractCaptions, CaptionExtractionError } from "ytce";

try {
  const captions = await extractCaptions("invalid-video-id");
} catch (error) {
  if (error instanceof CaptionExtractionError) {
    console.error(`Caption extraction failed: ${error.message}`);
    console.error(`Video ID: ${error.videoId}`);
  }
}
```

## License

MIT
