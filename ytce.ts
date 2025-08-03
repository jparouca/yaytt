#!/usr/bin/env node
import { extractCaptions } from './dist/index.js';
import { writeFileSync } from 'fs';
const videoInput = process.argv[2];
const aggressiveFlag = process.argv.includes('--aggressive');
if (!videoInput) {
    console.log('Usage: ytce <youtube-url-or-video-id> [--aggressive]');
    console.log('Example: ytce dQw4w9WgXcQ');
    console.log('Example: ytce "https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    console.log('Example: ytce dQw4w9WgXcQ --aggressive');
    console.log('');
    console.log('Options:');
    console.log('  --aggressive  Ultra-aggressive deduplication (removes more overlaps)');
    process.exit(1);
}
async function extractTranscript(videoInput) {
    try {
        console.log(`Extracting captions from: ${videoInput}`);
        if (aggressiveFlag) {
            console.log('Using ultra-aggressive deduplication mode');
        }
        const options = aggressiveFlag ? {
            deduplicationOptions: {
                aggressiveMode: true
            }
        } : {};
        const captions = await extractCaptions(videoInput, options);
        if (captions && captions.length > 0) {
            console.log(`Successfully extracted ${captions.length} captions`);
            let videoId = videoInput;
            if (videoInput.includes('youtube.com') || videoInput.includes('youtu.be')) {
                const urlMatch = videoInput.match(/(?:v=|\/|^)([a-zA-Z0-9_-]{11})/);
                videoId = urlMatch ? urlMatch[1] : 'unknown';
            }
            const transcript = captions.map(caption => {
                const minutes = Math.floor(caption.start / 60);
                const seconds = Math.floor(caption.start % 60);
                const timestamp = `[${minutes}:${seconds.toString().padStart(2, '0')}]`;
                return `${timestamp} ${caption.text}`;
            }).join('\n');
            const filename = `transcript_${videoId}.txt`;
            writeFileSync(filename, transcript, 'utf8');
            console.log(`Transcript saved to: ${filename}`);
            const totalDuration = Math.max(...captions.map(c => c.start + c.dur));
            const minutes = Math.floor(totalDuration / 60);
            const seconds = Math.floor(totalDuration % 60);
            console.log(`Video duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
            console.log(`Total caption segments: ${captions.length}`);
            console.log('\n--- Preview (first 5 captions) ---');
            captions.slice(0, 5).forEach(caption => {
                const mins = Math.floor(caption.start / 60);
                const secs = Math.floor(caption.start % 60);
                const time = `[${mins}:${secs.toString().padStart(2, '0')}]`;
                console.log(`${time} ${caption.text}`);
            });
        }
        else {
            console.log('No captions found for this video');
            console.log('   This video might not have captions available or they might be disabled');
        }
    }
    catch (error) {
        console.log(`Error extracting captions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (error instanceof Error) {
            if (error.message.includes('Video unavailable')) {
                console.log('   The video might be private, deleted, or region-restricted');
            }
            else if (error.message.includes('Transcript disabled')) {
                console.log('   Captions are disabled for this video');
            }
            else {
                console.log('   Try with a different video that has captions enabled');
            }
        }
        process.exit(1);
    }
}
extractTranscript(videoInput);
