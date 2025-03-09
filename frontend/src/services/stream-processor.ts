/**
 * Stream processor for handling LLM streaming responses
 * Centralizes stream processing logic and provides a clean API for components
 */

import { BehaviorSubject } from 'rxjs';

export interface StreamingState {
  isStreaming: boolean;
  activeCardId?: string;
  activePlayerId?: string;
  streamContent: string;
  streamComplete: boolean;
  error?: string;
}

export interface StreamChunk {
  type: string;
  content: string;
  cardId?: string;
  playerId?: string;
  correlationId: string;
}

export interface ParsedNarrative {
  narrative?: string;
  effects?: Array<{
    narration: string;
    type?: string;
    value?: number;
  }>;
}

const INITIAL_STREAMING_STATE: StreamingState = {
  isStreaming: false,
  streamContent: '',
  streamComplete: false
};

class StreamProcessor {
  private streamingState$ = new BehaviorSubject<StreamingState>(INITIAL_STREAMING_STATE);
  private accumulatedText = '';
  private streamStartTime = 0;
  private firstChunkTime = 0;
  private chunkCount = 0;
  
  // Parsers for JSON stream content
  private narrativeRegex = /"narrative"\s*:\s*"([^"]+)"/;
  private stateChangesRegex = /"stateChanges"\s*:\s*\[([\s\S]*?)\]/;
  private narrationRegex = /"narration"\s*:\s*"([^"]+)"/;
  
  // Observers
  getStreamingState() {
    return this.streamingState$.asObservable();
  }
  
  getCurrentState(): StreamingState {
    return this.streamingState$.value;
  }
  
  // Stream event handlers
  handleStreamStart(data: {
    cardId: string;
    playerId: string;
    timestamp: number;
    correlationId: string;
  }) {
    // Record stream start time for latency measurement
    this.streamStartTime = Date.now();
    this.firstChunkTime = 0;
    this.chunkCount = 0;
    
    console.log(`[LATENCY] LLM stream started at client time ${this.streamStartTime}ms (server time: ${data.timestamp}ms)`);
    console.log('LLM stream started:', data);
    
    // Reset accumulated text
    this.accumulatedText = '';
    
    // Update streaming state
    this.streamingState$.next({
      isStreaming: true,
      activeCardId: data.cardId,
      activePlayerId: data.playerId,
      streamContent: '',
      streamComplete: false
    });
    
    return null;
  }
  
  handleStreamChunk(chunk: StreamChunk): ParsedNarrative | null {
    if (!this.streamingState$.value.isStreaming) return null;
    
    // Get current time for latency measurement
    const currentTime = Date.now();
    this.chunkCount++;
    
    // Track first chunk arrival time
    if (this.firstChunkTime === 0) {
      this.firstChunkTime = currentTime;
      const timeSinceStart = this.firstChunkTime - this.streamStartTime;
      console.log(`[LATENCY] First chunk received after ${timeSinceStart}ms`);
    }
    
    // Log every 5th chunk to avoid flooding
    if (this.chunkCount % 5 === 0) {
      const timeSinceStart = currentTime - this.streamStartTime;
      console.log(`[LATENCY] Chunk #${this.chunkCount} received after ${timeSinceStart}ms`);
    }
    
    // Accumulate content for JSON parsing
    this.accumulatedText += chunk.content;
    
    // Update streaming state with new content
    this.streamingState$.next({
      ...this.streamingState$.value,
      streamContent: this.streamingState$.value.streamContent + chunk.content
    });
    
    // Extract and return any parsed narratives or effects
    return this.tryParseStreamContent(this.accumulatedText, false);
  }
  
  handleStreamEnd(data: {
    cardId: string;
    playerId: string;
    timestamp: number;
    correlationId: string;
  }): ParsedNarrative | null {
    // Calculate total streaming time
    const endTime = Date.now();
    const totalStreamTime = endTime - this.streamStartTime;
    console.log(`[LATENCY] LLM stream completed after ${totalStreamTime}ms with ${this.chunkCount} chunks`);
    console.log(`[LATENCY] First chunk arrived after ${this.firstChunkTime - this.streamStartTime}ms`);
    console.log('LLM stream ended:', data);
    
    // Update streaming state
    this.streamingState$.next({
      ...this.streamingState$.value,
      isStreaming: false,
      streamComplete: true
    });
    
    // Process one final time to catch any missed JSON
    const finalParsed = this.tryParseStreamContent(this.accumulatedText, true);
    
    // Clear accumulated text
    this.accumulatedText = '';
    
    return finalParsed;
  }
  
  handleStreamError(data: {
    message: string;
    cardId?: string;
    playerId?: string;
    correlationId: string;
  }) {
    console.error('LLM stream error:', data);
    
    // Update streaming state
    this.streamingState$.next({
      isStreaming: false,
      streamContent: '',
      streamComplete: true,
      error: data.message
    });
    
    // Clear accumulated text
    this.accumulatedText = '';
    
    return null;
  }
  
  // Parse stream content to extract narrative and effects
  private tryParseStreamContent(text: string, isFinal: boolean = false): ParsedNarrative | null {
    try {
      const result: ParsedNarrative = {};
      
      // Try to extract narrative
      const narrativeMatch = text.match(this.narrativeRegex);
      if (narrativeMatch) {
        result.narrative = narrativeMatch[1];
        const currentTime = Date.now();
        
        // Log when we first extract the narrative
        if (!isFinal) {
          console.log(`[LATENCY] Narrative extracted after ${currentTime - this.streamStartTime}ms`);
        }
      }
      
      // Try to extract effects
      const stateChangesMatch = text.match(this.stateChangesRegex);
      if (stateChangesMatch) {
        const stateChangesText = stateChangesMatch[1];
        const currentTime = Date.now();
        
        // Log when we first extract state changes
        if (!isFinal) {
          console.log(`[LATENCY] State changes extracted after ${currentTime - this.streamStartTime}ms`);
        }
        
        // Find individual effect objects
        const objectRegex = /\{[\s\S]*?("narration"\s*:\s*"[^"]+")([\s\S]*?)\}/g;
        result.effects = [];
        
        // For each state change with a narration, add it to effects
        let objectMatch;
        let effectCount = 0;
        
        while ((objectMatch = objectRegex.exec(stateChangesText)) !== null) {
          const narrationMatch = objectMatch[1].match(this.narrationRegex);
          if (narrationMatch) {
            const narration = narrationMatch[1];
            effectCount++;
            
            // Parse additional effect data if available
            const effectData = objectMatch[0]; // Full effect object
            
            // Attempt to extract type and value
            const typeMatch = effectData.match(/"type"\s*:\s*"([^"]+)"/);
            const valueMatch = effectData.match(/"value"\s*:\s*(\d+)/);
            
            result.effects.push({
              narration,
              type: typeMatch ? typeMatch[1] : undefined,
              value: valueMatch ? parseInt(valueMatch[1]) : undefined
            });
          }
        }
        
        // Log the number of effects found (only on first extraction)
        if (!isFinal && effectCount > 0) {
          console.log(`[LATENCY] Extracted ${effectCount} effect narrations after ${currentTime - this.streamStartTime}ms`);
        }
      }
      
      return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
      console.warn('Error parsing stream content', error);
      return null;
    }
  }
  
  reset() {
    this.streamingState$.next(INITIAL_STREAMING_STATE);
    this.accumulatedText = '';
  }
}

// Export singleton instance
export const streamProcessor = new StreamProcessor();