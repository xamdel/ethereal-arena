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
    console.log('Connecting to game server...');
    
    // Handle connection change
    const handleConnect = () => {
      console.log('Connected to game server');
      setIsConnected(true);
      dispatchUI({ 
        type: 'SET_CONNECTION', 
        payload: { isConnected: true } 
      });
      
      // Join the game room
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
      setLastSyncTime(Date.now());
      
      dispatch({
        type: 'SET_GAME_STATE',
        payload: data.gameState
      });
      
      // If this update was from a card play and we have streaming,
      // mark streaming as complete
      if (data.action?.type === 'PLAY_CARD' && streamingState.isStreaming && 
          data.action.payload?.cardId === streamingState.activeCardId) {
        setStreamingState(prev => ({
          ...prev,
          streamComplete: true
        }));
      }
    };
    
    // Handle streaming events
    const handleStreamStart = (data: { 
      cardId: string;
      playerId: string;
      timestamp: number;
    }) => {
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
    };
    
    // Function to attempt extracting the narrative from streaming JSON
    const tryExtractNarrative = (text: string, cardId?: string, playerId?: string, isFinal: boolean = false) => {
      try {
        // Look for narrative in JSON
        const match = text.match(/"narrative"\s*:\s*"([^"]+)"/);
        if (match) {
          const narrative = match[1];
          
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
          
          // Find individual effect objects
          const objectRegex = /\{[\s\S]*?("narration"\s*:\s*"[^"]+")([\s\S]*?)\}/g;
          const effects = [];
          
          // For each state change with a narration, add it to the game log
          let objectMatch;
          while ((objectMatch = objectRegex.exec(stateChangesText)) !== null) {
            const narrationMatch = objectMatch[1].match(/"narration"\s*:\s*"([^"]+)"/);
            if (narrationMatch) {
              const narration = narrationMatch[1];
              
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
        }
      } catch (error) {
        console.warn('Error extracting effects from stream', error);
      }
    };
    
    // Register socket event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socketService.onGameStateUpdate(handleGameStateUpdate);
    
    // Register streaming event handlers
    socketService.onLLMStreamStart(handleStreamStart);
    socketService.onLLMStreamChunk(handleStreamChunk);
    socketService.onLLMStreamEnd(handleStreamEnd);
    socketService.onLLMStreamError(handleStreamError);
    
    // Clean up event listeners
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('llm-stream-start', handleStreamStart);
      socket.off('llm-stream-chunk', handleStreamChunk);
      socket.off('llm-stream-end', handleStreamEnd);
      socket.off('llm-stream-error', handleStreamError);
      
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