import { Caption } from './types.js';

export interface DeduplicationOptions {
  enabled?: boolean;
  timeThreshold?: number;
  similarityThreshold?: number;
  mergePartialMatches?: boolean;
  aggressiveMode?: boolean;
}

export class CaptionDeduplicator {
  private options: Required<DeduplicationOptions>;

  constructor(options: DeduplicationOptions = {}) {
    this.options = {
      enabled: true,
      timeThreshold: 3,
      similarityThreshold: 0.8,
      mergePartialMatches: true,
      aggressiveMode: false,
      ...options
    };
  }

  deduplicate(captions: Caption[]): Caption[] {
    if (!this.options.enabled || captions.length === 0) {
      return captions;
    }

    const sortedCaptions = [...captions].sort((a, b) => a.start - b.start);
    
    const groups = this.groupSimilarCaptions(sortedCaptions);
    let result = groups.map(group => this.mergeCaptions(group));
    result = this.removeTextContinuations(result);
    result = this.finalCleanup(result);
    
    if (this.options.aggressiveMode) {
      result = this.ultraAggressiveCleanup(result);
    }
    
    return result;
  }

  private groupSimilarCaptions(captions: Caption[]): Caption[][] {
    const groups: Caption[][] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < captions.length; i++) {
      if (used.has(i)) continue;
      
      const group: Caption[] = [captions[i]];
      used.add(i);
      
      const currentText = this.cleanText(captions[i].text);
      
      for (let j = i + 1; j < captions.length; j++) {
        if (used.has(j)) continue;
        
        const timeDiff = captions[j].start - captions[i].start;
        if (timeDiff > this.options.timeThreshold) break;
        
        const otherText = this.cleanText(captions[j].text);
        
        if (this.areSimilarCaptions(currentText, otherText)) {
          group.push(captions[j]);
          used.add(j);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  private areSimilarCaptions(text1: string, text2: string): boolean {
    if (text1 === text2) return true;
    
    if (text1.includes(text2) || text2.includes(text1)) return true;
    
    const similarity = this.calculateSimilarity(text1, text2);
    if (similarity >= this.options.similarityThreshold) return true;
    
    const words1 = text1.split(' ').filter(w => w.length > 2);
    const words2 = text2.split(' ').filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    const commonWords = words1.filter(word => words2.includes(word));
    const wordSimilarity = commonWords.length / Math.max(words1.length, words2.length);
    
    return wordSimilarity >= 0.6;
  }

  private removeTextContinuations(captions: Caption[]): Caption[] {
    const result: Caption[] = [];
    
    for (let i = 0; i < captions.length; i++) {
      const current = captions[i];
      const currentClean = this.cleanText(current.text);
      
      let shouldSkip = false;
      
      // Check if this caption is a continuation of a previous one
      for (let j = Math.max(0, i - 3); j < i; j++) {
        const previous = captions[j];
        const previousClean = this.cleanText(previous.text);
        
        // Skip if current text is already contained in a recent previous caption
        if (previousClean.includes(currentClean) && currentClean.length < previousClean.length * 0.9) {
          shouldSkip = true;
          break;
        }
        
        // Skip if this looks like a partial repeat
        if (this.isPartialRepeat(previousClean, currentClean)) {
          shouldSkip = true;
          break;
        }
      }
      
      // Check if next caption contains this one (look ahead)
      if (!shouldSkip) {
        for (let j = i + 1; j < Math.min(captions.length, i + 3); j++) {
          const next = captions[j];
          const nextClean = this.cleanText(next.text);
          
          // Skip if next caption contains this one and is much longer
          if (nextClean.includes(currentClean) && 
              next.start - current.start <= this.options.timeThreshold &&
              currentClean.length < nextClean.length * 0.8) {
            shouldSkip = true;
            break;
          }
        }
      }
      
      if (!shouldSkip) {
        result.push(current);
      }
    }
    
    return result;
  }

  private isPartialRepeat(text1: string, text2: string): boolean {
    // Check if text2 starts with the same words as text1 ends with
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    if (words1.length < 3 || words2.length < 3) return false;
    
    // Get last few words of text1 and first few words of text2
    const lastWords1 = words1.slice(-3).join(' ');
    const firstWords2 = words2.slice(0, 3).join(' ');
    
    // Check for overlap
    return lastWords1.includes(firstWords2) || firstWords2.includes(lastWords1);
  }

  private finalCleanup(captions: Caption[]): Caption[] {
    const result: Caption[] = [];
    
    for (let i = 0; i < captions.length; i++) {
      const current = captions[i];
      const currentClean = this.cleanText(current.text);
      
      // Skip very short captions that are likely noise
      if (currentClean.length < 10) {
        continue;
      }
      
      // Skip if identical to previous caption
      if (result.length > 0) {
        const lastClean = this.cleanText(result[result.length - 1].text);
        if (currentClean === lastClean) {
          continue;
        }
      }
      
      result.push(current);
    }
    
    return result;
  }

  private ultraAggressiveCleanup(captions: Caption[]): Caption[] {
    const result: Caption[] = [];
    
    for (let i = 0; i < captions.length; i++) {
      const current = captions[i];
      const currentClean = this.cleanText(current.text);
      
      let shouldSkip = false;
      
      // Check against the last few captions in result
      for (let j = Math.max(0, result.length - 5); j < result.length; j++) {
        const existing = result[j];
        const existingClean = this.cleanText(existing.text);
        
        // Skip if this caption seems to continue the previous one
        if (this.isContinuation(existingClean, currentClean)) {
          // Merge the longer text into the existing caption
          if (currentClean.length > existingClean.length) {
            result[j] = current; // Replace with longer version
          }
          shouldSkip = true;
          break;
        }
        
        // Skip if significant word overlap (even if not exact continuation)
        if (this.hasSignificantWordOverlap(existingClean, currentClean)) {
          // Keep the longer, more complete one
          if (currentClean.length > existingClean.length) {
            result[j] = current;
          }
          shouldSkip = true;
          break;
        }
      }
      
      if (!shouldSkip) {
        result.push(current);
      }
    }
    
    return result;
  }

  private isContinuation(text1: string, text2: string): boolean {
    // Check if text2 continues where text1 left off
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    if (words1.length < 3 || words2.length < 3) return false;
    
    // Get last 3 words of text1 and first 5 words of text2
    const lastWords1 = words1.slice(-3);
    const firstWords2 = words2.slice(0, 5);
    
    // Check if any of the last words appear in the first words
    const overlap = lastWords1.filter(word => firstWords2.includes(word));
    
    return overlap.length >= 2; // At least 2 words overlap
  }

  private hasSignificantWordOverlap(text1: string, text2: string): boolean {
    const words1 = text1.split(' ').filter(w => w.length > 3); // Only meaningful words
    const words2 = text2.split(' ').filter(w => w.length > 3);
    
    if (words1.length < 3 || words2.length < 3) return false;
    
    const commonWords = words1.filter(word => words2.includes(word));
    const overlapRatio = commonWords.length / Math.min(words1.length, words2.length);
    
    return overlapRatio >= 0.7; // 70% overlap of meaningful words
  }

  private mergeCaptions(captions: Caption[]): Caption {
    // Sort by start time
    captions.sort((a, b) => a.start - b.start);
    
    // Find the longest, most complete text
    const longestCaption = captions.reduce((longest, current) => {
      const currentClean = this.cleanText(current.text);
      const longestClean = this.cleanText(longest.text);
      
      // Prefer longer, more complete text
      if (currentClean.length > longestClean.length) {
        return current;
      }
      
      // If similar length, prefer the one without trailing incomplete words
      if (Math.abs(currentClean.length - longestClean.length) < 10) {
        if (this.isMoreComplete(currentClean, longestClean)) {
          return current;
        }
      }
      
      return longest;
    });
    
    // Use the earliest start time and calculate proper duration
    const earliestStart = Math.min(...captions.map(c => c.start));
    const latestEnd = Math.max(...captions.map(c => c.start + c.dur));
    
    return {
      start: earliestStart,
      dur: latestEnd - earliestStart,
      text: longestCaption.text
    };
  }

  private removeRedundantCaptions(captions: Caption[]): Caption[] {
    const result: Caption[] = [];
    
    for (let i = 0; i < captions.length; i++) {
      const current = captions[i];
      const currentClean = this.cleanText(current.text);
      
      // Skip if this caption's text is completely contained in the next one
      if (i < captions.length - 1) {
        const next = captions[i + 1];
        const nextClean = this.cleanText(next.text);
        
        // If current text is fully contained in next and they're close in time
        if (nextClean.includes(currentClean) && 
            next.start - current.start <= this.options.timeThreshold &&
            currentClean.length < nextClean.length * 0.8) {
          continue; // Skip this redundant caption
        }
      }
      
      // Skip if this caption's text is completely contained in the previous one
      if (result.length > 0) {
        const previous = result[result.length - 1];
        const previousClean = this.cleanText(previous.text);
        
        if (previousClean.includes(currentClean) &&
            current.start - previous.start <= this.options.timeThreshold &&
            currentClean.length < previousClean.length * 0.8) {
          continue; // Skip this redundant caption
        }
      }
      
      result.push(current);
    }
    
    return result;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1;
    
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1;
    
    // Check if shorter text is contained in longer text
    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }
    
    // Calculate Levenshtein distance for more complex similarity
    return (longer.length - this.levenshteinDistance(text1, text2)) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private cleanText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\[música\]/gi, '') // Remove [Música] tags
      .replace(/\[music\]/gi, '')  // Remove [Music] tags
      .replace(/[^\w\s]/g, ' ')    // Remove punctuation
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();
  }

  private isMoreComplete(text1: string, text2: string): boolean {
    // Check if text1 ends with a complete word while text2 doesn't
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    if (words1.length === words2.length) {
      // Same number of words, prefer the one that doesn't cut off mid-sentence
      return !text1.endsWith(' ') && text2.endsWith(' ');
    }
    
    return words1.length > words2.length;
  }
}