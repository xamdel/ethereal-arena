'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useGame } from '@/context';
import { GameAction, GameState } from '@/types';
import * as socketService from '@/services/socket';
import { v4 as uuidv4 } from 'uuid';

interface StreamingState {
  isStreaming: boolean;
  activeCardId?: string;
  activePlayerId?: string;
  streamContent: string;
  streamComplete: boolean;
}

/**
 * Custom hook for handling state synchronization with the server
 * Includes support for streaming LLM responses
 */
function createGameSync() {
    const [isConnected, setIsConnected] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(0);
    const [streamingState, setStreamingState] = useState<StreamingState>({
        isStreaming: false,
        streamContent: '',
        streamComplete: false
    });

    // Refs
    const accumulatedTextRef = useRef('');
    const gameIdRef = useRef<string | null>(null);
    const streamStartTimeRef = useRef<number>(0);
    const firstChunkTimeRef = useRef<number>(0);
    const chunkCountRef = useRef<number>(0);
    const gameStateRef = useRef<GameState>({} as GameState); // Keep track of gameState
    const dispatchRef = useRef<any>(null); // Keep track of dispatch
    const dispatchUIRef = useRef<any>(null); // Keep track of dispatchUI

    // Centralized sendAction function with correlation IDs and Promise-based API
    const sendAction = useCallback(async (action: GameAction, { streamResponse = false } = {}) => {
        if (!gameIdRef.current) {
            console.warn("Game ID not set. Cannot send action.");
            return Promise.reject(new Error("Game ID not set."));
        }

        const correlationId = action.id; // Use the action ID as the correlation ID
        console.log(`Sending action with correlationId ${correlationId}:`, action);

        return new Promise((resolve, reject) => {
            // Send action via socket service, which now handles timeouts and queuing
            socketService.sendGameAction(gameIdRef.current!, { ...action, correlationId })
              .then((response) => {
                // For non-streaming actions, dispatch immediately
                if (!streamResponse) {
                    if (response && response.gameState) {
                        dispatchRef.current({
                                type: 'SET_GAME_STATE',
                            payload: response.gameState
                        });
                    }
                  resolve(response);
                } else {
                  // For streaming, resolve is handled in streamEnd
                  resolve(response);
                }
              }).catch(reject);
          });
    }, []);

    // Set up socket connections and event handlers
    useEffect(() => {
        // Initialize socket connection
        const socket = socketService.initSocket();
        console.log('Connecting to game server via WebSocket...');

        // Handle connection change
        const handleConnect = () => {
            console.log('✅ Connected to game server via WebSocket');
            setIsConnected(true);
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_CONNECTION',
                payload: { isConnected: true }
            });

            // Re-join the game room on reconnect
            if (gameIdRef.current) {
                console.log(`Joining game room: ${gameIdRef.current}`);
                socketService.joinGameRoom(gameIdRef.current, ''); // Assuming player ID is handled elsewhere
            }
        };

        const handleDisconnect = () => {
            console.log('Disconnected from game server');
            setIsConnected(false);
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_CONNECTION',
                payload: { isConnected: false }
            });
        };

        // Handle game state updates (now includes correlationId)
        const handleGameStateUpdate = (data: { gameState: GameState, action?: GameAction, correlationId?: string }) => {
            console.log('Received game state update:', data);
            const updateTime = Date.now();
            setLastSyncTime(updateTime);

            // Dispatch the full game state update
            if (data.gameState) {
                dispatchRef.current && dispatchRef.current({
                    type: 'SET_GAME_STATE',
                    payload: data.gameState
                });
            }
        };

        // Handle streaming events
        const handleStreamStart = (data: {
            cardId: string;
            playerId: string;
            timestamp: number;
            correlationId: string;
        }) => {
            // Record stream start time for latency measurement
            const clientStartTime = Date.now();
            streamStartTimeRef.current = clientStartTime;
            firstChunkTimeRef.current = 0;
            chunkCountRef.current = 0;

            console.log(`[LATENCY] LLM stream started at client time ${clientStartTime}ms (server time: ${data.timestamp}ms)`);
            console.log('LLM stream started:', data);

            // Reset accumulated text
            accumulatedTextRef.current = '';

            // Update streaming state
            setStreamingState({
                isStreaming: true,
                activeCardId: data.cardId,
                activePlayerId: data.playerId,
                streamContent: '',
                streamComplete: false
            });

            // Update UI state to show streaming
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_STREAMING',
                payload: {
                    isStreaming: true,
                    cardId: data.cardId,
                    playerId: data.playerId
                }
            });
        };

        const handleStreamChunk = (data: {
            type: string;
            content: string;
            cardId: string;
            playerId: string;
            correlationId: string;
        }) => {
            if (!streamingState.isStreaming) return;

            // Get current time for latency measurement
            const currentTime = Date.now();
            chunkCountRef.current++;

            // Track first chunk arrival time
            if (firstChunkTimeRef.current === 0) {
                firstChunkTimeRef.current = currentTime;
                const timeSinceStart = firstChunkTimeRef.current - streamStartTimeRef.current;
                console.log(`[LATENCY] First chunk received after ${timeSinceStart}ms`);
            }

            // Log every 5th chunk to avoid flooding
            if (chunkCountRef.current % 5 === 0) {
                const timeSinceStart = currentTime - streamStartTimeRef.current;
                console.log(`[LATENCY] Chunk #${chunkCountRef.current} received after ${timeSinceStart}ms`);
            }

            // Accumulate content for JSON parsing
            accumulatedTextRef.current += data.content;

            // Update streaming state with new content
            setStreamingState(prev => ({
                ...prev,
                streamContent: prev.streamContent + data.content
            }));

            // If this is an on-play-description, add it to the game log immediately
            if (data.type === 'on-play-description') {
                dispatchUIRef.current && dispatchUIRef.current({
                    type: 'ADD_LOG_ENTRY',
                    payload: {
                        type: 'on-play-description',
                        content: data.content,
                        cardId: data.cardId,
                        playerId: data.playerId
                    }
            });
                console.log(`[LATENCY] On-play description displayed after ${currentTime - streamStartTimeRef.current}ms`);
            }

            // Try to extract and display the narrative if possible
            tryExtractNarrative(accumulatedTextRef.current, data.cardId, data.playerId);

            // Try to extract effects if possible
            tryExtractEffects(accumulatedTextRef.current, data.cardId, data.playerId);
        };

        const handleStreamEnd = (data: {
            cardId: string;
            playerId: string;
            timestamp: number;
            correlationId: string;
        }) => {
            // Calculate total streaming time
            const endTime = Date.now();
            const totalStreamTime = endTime - streamStartTimeRef.current;
            console.log(`[LATENCY] LLM stream completed after ${totalStreamTime}ms with ${chunkCountRef.current} chunks`);
            console.log(`[LATENCY] First chunk arrived after ${firstChunkTimeRef.current - streamStartTimeRef.current}ms`);
            console.log('LLM stream ended:', data);

            // Update streaming state
            setStreamingState(prev => ({
                ...prev,
                isStreaming: false,
                streamComplete: true
            }));

            // Process one final time to catch any missed JSON
            tryExtractNarrative(accumulatedTextRef.current, data.cardId, data.playerId, true);
            tryExtractEffects(accumulatedTextRef.current, data.cardId, data.playerId, true);

            // Clear accumulated text
            accumulatedTextRef.current = '';

            // Update UI state to show streaming complete
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_STREAMING',
                payload: {
                    isStreaming: false,
                    cardId: data.cardId,
                    playerId: data.playerId
                }
            });

            // Important: Turn off processing state since streaming is complete
            // This is needed because we don't turn it off in dispatchAction when using socket
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_PROCESSING',
                payload: { isProcessing: false }
            });
        };

        const handleStreamError = (data: {
            message: string;
            cardId?: string;
            playerId?: string;
            correlationId: string;
        }) => {
            console.error('LLM stream error:', data);

            // Update streaming state
            setStreamingState({
                isStreaming: false,
                streamContent: '',
                streamComplete: true
            });

            // Show error message
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'ADD_LOG_ENTRY',
                payload: {
                    type: 'error',
                    content: `Error processing card: ${data.message}`,
                    cardId: data.cardId,
                    playerId: data.playerId
                }
            });

            // Update UI state to show streaming error
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_STREAMING',
                payload: {
                    isStreaming: false,
                    error: data.message
                }
            });

            // Important: Turn off processing state in case of error
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_PROCESSING',
                payload: { isProcessing: false }
            });

            // Show error notification
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_ERROR',
                payload: { message: `Stream error: ${data.message}` }
            });
        };

        // Function to attempt extracting the narrative from streaming JSON
        const tryExtractNarrative = (text: string, cardId?: string, playerId?: string, isFinal: boolean = false) => {
            try {
                // Look for narrative in JSON
                const match = text.match(/"narrative"\s*:\s*"([^"]+)"/);
                if (match) {
                    const narrative = match[1];
                    const currentTime = Date.now();

                    // Log when we first extract the narrative
                    if (!isFinal) {
                        console.log(`[LATENCY] Narrative extracted after ${currentTime - streamStartTimeRef.current}ms`);
                    }

                    // Add narrative to game log
                    dispatchUIRef.current && dispatchUIRef.current({
                        type: 'ADD_LOG_ENTRY',
                        payload: {
                            type: 'narrative',
                            content: narrative,
                            cardId,
                            playerId,
                            isFinal
                        }
                    });
                }
            } catch (error) {
                console.warn('Error extracting narrative from stream', error);
            }
        };

        // Function to attempt extracting state changes/effects from streaming JSON
        const tryExtractEffects = (text: string, cardId?: string, playerId?: string, isFinal: boolean = false) => {
            try {
                // Look for state changes array in JSON
                const match = text.match(/"stateChanges"\s*:\s*\[([\s\S]*?)\]/);
                if (match) {
                    const stateChangesText = match[1];
                    const currentTime = Date.now();

                    // Log when we first extract state changes
                    if (!isFinal) {
                        console.log(`[LATENCY] State changes extracted after ${currentTime - streamStartTimeRef.current}ms`);
                    }

                    // Find individual effect objects
                    const objectRegex = /\{[\s\S]*?("narration"\s*:\s*"[^"]+")([\s\S]*?)\}/g;
                    const effects = [];
                    let effectCount = 0;

                    // For each state change with a narration, add it to the game log
                    let objectMatch;
                    while ((objectMatch = objectRegex.exec(stateChangesText)) !== null) {
                        const narrationMatch = objectMatch[1].match(/"narration"\s*:\s*"([^"]+)"/);
                        if (narrationMatch) {
                            const narration = narrationMatch[1];
                            effectCount++;

                            dispatchUIRef.current && dispatchUIRef.current({
                                type: 'ADD_LOG_ENTRY',
                                payload: {
                                    type: 'effect',
                                    content: narration,
                                    cardId,
                                    playerId,
                                    isFinal
                                }
                            });
                        }
                    }

                    // Log the number of effects found (only on first extraction)
                    if (!isFinal && effectCount > 0) {
                        console.log(`[LATENCY] Extracted ${effectCount} effect narrations after ${currentTime - streamStartTimeRef.current}ms`);
                    }
                }
            } catch (error) {
                console.warn('Error extracting effects from stream', error);
            }
        };

        // Register socket event handlers
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('error', (errorData) => {
            console.error('Socket error:', errorData);
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_ERROR',
                payload: { message: `Server error: ${errorData.message || 'Unknown error'}` }
            });

            // Turn off processing state in case of error
            dispatchUIRef.current && dispatchUIRef.current({
                type: 'SET_PROCESSING',
                payload: { isProcessing: false }
            });
        });

        socketService.onActionReceived((data) => {
            // Handle action responses (if needed)
            console.log("action-received", data);
        });

        socketService.onGameStateUpdate(handleGameStateUpdate);

        // Register streaming event handlers
        socketService.onLLMStreamStart(handleStreamStart);
        socketService.onLLMStreamChunk(handleStreamChunk);
        socketService.onLLMStreamEnd(handleStreamEnd);
        socketService.onLLMStreamError(handleStreamError);

        // Log all socket events for debugging
        console.log('SOCKET DEBUG: Registered socket event handlers:');
        console.log('- connect');
        console.log('- disconnect');
        console.log('- game-state-update');
        console.log('- llm-stream-start');
        console.log('- llm-stream-chunk');
        console.log('- llm-stream-end');
        console.log('- llm-stream-error');

        // Clean up event listeners
        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('error'); // Remove error handler
            socket.off('game-state-update', handleGameStateUpdate);
            socket.off('llm-stream-start', handleStreamStart);
            socket.off('llm-stream-chunk', handleStreamChunk);
            socket.off('llm-stream-end', handleStreamEnd);
            socket.off('llm-stream-error', handleStreamError);

            console.log('SOCKET DEBUG: Cleaned up socket event handlers');

            if (gameIdRef.current) {
                socketService.leaveGameRoom(gameIdRef.current);
            }

            socketService.disconnectSocket();
        };
    }, []);

    // Function to manually trigger a sync with the server (not used in WebSocket-only)
    const syncState = async () => {
      return;
    };

    const initialize = (gameState: GameState, dispatch: any, dispatchUI: any) => {
        gameIdRef.current = gameState.id;
        gameStateRef.current = gameState;
        dispatchRef.current = dispatch;
        dispatchUIRef.current = dispatchUI;

        // Connect after initializing
        const socket = socketService.initSocket();
        if (!socket.connected) {
          socket.connect();
        }
    }

    return {
        isConnected,
        lastSyncTime,
        syncState,
        sendAction,
        streamingState,
        initialize
    };
}

// Export a singleton instance
export const gameSync = createGameSync();
