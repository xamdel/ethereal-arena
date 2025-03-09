'use client';

import { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context';
import { GameAction, GameState } from '@/types';
import * as socketService from '@/services/socket';

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
export function useGameSync() {
  const { gameState, dispatch, dispatchUI } = useGame();
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamContent: '',
    streamComplete: false
  });
  
  // Ref to accumulate JSON chunks that can be parsed
  const accumulatedTextRef = useRef('');
  const gameIdRef = useRef<string | null>(null);

  // Set up socket connections and event handlers
  useEffect(() => {
    if (!gameState.id) return;
    
    gameIdRef.current = gameState.id;
    
    // Initialize socket connection
    const socket = socketService.initSocket();
    console.log('Connecting to game server via WebSocket...');
    
    // Try to connect and join room immediately 
    socketService.joinGameRoom(gameState.id);
    
    // Handle connection change
    const handleConnect = () => {
      console.log('✅ Connected to game server via WebSocket');
      setIsConnected(true);
      dispatchUI({ 
        type: 'SET_CONNECTION', 
        payload: { isConnected: true } 
      });
      
      // Re-join the game room on reconnect
      console.log(`Joining game room: ${gameState.id}`);
      socketService.joinGameRoom(gameState.id!);
    };
    
    const handleDisconnect = () => {
      console.log('Disconnected from game server');
      setIsConnected(false);
      dispatchUI({ 
        type: 'SET_CONNECTION', 
        payload: { isConnected: false } 
      });
    };
    
    // Handle game state updates
    const handleGameStateUpdate = (data: { gameState: GameState, action?: GameAction }) => {
      console.log('Received game state update:', data);
      const updateTime = Date.now();
      setLastSyncTime(updateTime);
      
      dispatch({
        type: 'SET_GAME_STATE',
        payload: data.gameState
      });
      
      // If this update was from a card play and we have streaming,
      // mark streaming as complete and log timing info
      if (data.action?.type === 'PLAY_CARD' && 
          data.action.payload?.cardId === streamingState.activeCardId) {
        
        // Log latency measurements for the complete game state update
        if (streamStartTimeRef.current > 0) {
          const totalTimeToGameState = updateTime - streamStartTimeRef.current;
          console.log(`[LATENCY] Complete game state update received after ${totalTimeToGameState}ms`);
          console.log(`[LATENCY] Time from stream end to game state: ${streamingState.streamComplete ? 
            updateTime - (streamStartTimeRef.current + (updateTime - streamStartTimeRef.current)) : 'N/A'}`);
        }
        
        setStreamingState(prev => ({
          ...prev,
          streamComplete: true
        }));
      }
    };
    
    // Store the stream start time for latency measurements
    const streamStartTimeRef = useRef<number>(0);
    const firstChunkTimeRef = useRef<number>(0);
    const chunkCountRef = useRef<number>(0);

    // Handle streaming events
    const handleStreamStart = (data: { 
      cardId: string;
      playerId: string;
      timestamp: number;
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
      dispatchUI({
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
        dispatchUI({
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
      dispatchUI({
        type: 'SET_STREAMING',
        payload: {
          isStreaming: false,
          cardId: data.cardId,
          playerId: data.playerId
        }
      });
      
      // Important: Turn off processing state since streaming is complete
      // This is needed because we don't turn it off in dispatchAction when using socket
      dispatchUI({ 
        type: 'SET_PROCESSING', 
        payload: { isProcessing: false } 
      });
    };
    
    const handleStreamError = (data: {
      message: string;
      cardId?: string;
      playerId?: string;
    }) => {
      console.error('LLM stream error:', data);
      
      // Update streaming state
      setStreamingState({
        isStreaming: false,
        streamContent: '',
        streamComplete: true
      });
      
      // Show error message
      dispatchUI({
        type: 'ADD_LOG_ENTRY',
        payload: {
          type: 'error',
          content: `Error processing card: ${data.message}`,
          cardId: data.cardId,
          playerId: data.playerId
        }
      });
      
      // Update UI state to show streaming error
      dispatchUI({
        type: 'SET_STREAMING',
        payload: {
          isStreaming: false,
          error: data.message
        }
      });
      
      // Important: Turn off processing state in case of error
      dispatchUI({ 
        type: 'SET_PROCESSING', 
        payload: { isProcessing: false } 
      });
      
      // Show error notification
      dispatchUI({
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
          dispatchUI({
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
              
              dispatchUI({
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
      dispatchUI({
        type: 'SET_ERROR',
        payload: { message: `Server error: ${errorData.message || 'Unknown error'}` }
      });
      
      // Turn off processing state in case of error
      dispatchUI({ 
        type: 'SET_PROCESSING', 
        payload: { isProcessing: false } 
      });
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
  }, [gameState.id, dispatch, dispatchUI]);

  // Function to manually trigger a sync with the server
  const syncState = async () => {
    if (!gameState.id || !isConnected) {
      return false;
    }
    
    console.log('Manually syncing state with server...');
    setLastSyncTime(Date.now());
    
    // In a real implementation, we would make an API call here
    // For now, just update the UI
    dispatchUI({ type: 'SYNC_STATE' });
    
    return true;
  };

  // Function to send an action to the server
  const sendAction = async (action: GameAction) => {
    if (!gameState.id || !isConnected) {
      return false;
    }
    
    console.log('Sending action to server:', action);
    
    // Send the action via WebSocket
    socketService.sendGameAction(gameState.id, action);
    
    return true;
  };

  return {
    isConnected,
    lastSyncTime,
    syncState,
    sendAction,
    streamingState
  };
}