'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GameAction, GameState, ActionType } from '@/types';
import * as socketService from '@/services/socket';
import { connectionManager, ConnectionState } from '@/services/connection-manager';
import { streamProcessor, ParsedNarrative, StreamingState } from '@/services/stream-processor';
import { useSubscription } from './use-subscription';

// Module-level variables to store state
let gameId: string | null = null;
let dispatchFn: any = null;
let dispatchUIFn: any = null;
let cleanupHandlers: (() => void) | null = null;

/**
 * Helper functions for game sync outside of React lifecycle
 */
// Send action with correlation IDs
const sendAction = async (
  action: GameAction, 
  options: { streamResponse?: boolean } = {}
): Promise<any> => {
  if (!gameId) {
    console.warn("Game ID not set. Cannot send action.");
    return Promise.reject(new Error("Game ID not set."));
  }

  console.log(`Sending action:`, action);

  // Send through socket service
  return socketService.sendGameAction(
    gameId, 
    action, 
    options
  );
};

// Handle connection state changes
const handleConnectionStateChange = (state: ConnectionState) => {
  console.log(`Connection state changed to: ${state}`);
  
  if (dispatchUIFn) {
    dispatchUIFn({
      type: 'SET_CONNECTION',
      payload: { isConnected: state === 'connected' }
    });
  }
  
  // Re-join game room on reconnect
  if (state === 'connected' && gameId) {
    console.log(`Rejoining game room: ${gameId}`);
    socketService.joinGameRoom(gameId, ''); // Player ID handled elsewhere
  }
};

// Handle game state updates
const handleGameStateUpdate = (data: { gameState: GameState, action?: GameAction, correlationId?: string }) => {
  console.log('Received game state update:', data);
  
  // Dispatch the full game state update
  if (data.gameState && dispatchFn) {
    dispatchFn({
      type: ActionType.GAME_INIT,
      payload: data.gameState,
      playerId: 'system',
      timestamp: Date.now(),
      gameId: data.gameState.id,
      validated: true
    });
  }
};

// Add log entry helper
const addLogEntry = (entry: {
  type: string;
  content: string;
  cardId?: string;
  playerId?: string;
  isFinal?: boolean;
}) => {
  if (dispatchUIFn) {
    dispatchUIFn({
      type: 'ADD_LOG_ENTRY',
      payload: entry
    });
  }
};

// Process parsed stream content helper
const processParsedStreamContent = (
  parsed: ParsedNarrative,
  cardId?: string,
  playerId?: string,
  isFinal: boolean = false
) => {
  // Add narrative to log if available
  if (parsed.narrative) {
    addLogEntry({
      type: 'narrative',
      content: parsed.narrative,
      cardId,
      playerId,
      isFinal
    });
  }
  
  // Add effect narrations to log if available
  if (parsed.effects && parsed.effects.length > 0) {
    parsed.effects.forEach(effect => {
      if (effect.narration) {
        addLogEntry({
          type: 'effect',
          content: effect.narration,
          cardId,
          playerId,
          isFinal
        });
      }
    });
  }
};

// Stream event handlers
const handleStreamStart = (data: {
  cardId: string;
  playerId: string;
  timestamp: number;
  correlationId: string;
}) => {
  // Use stream processor to handle stream start
  streamProcessor.handleStreamStart(data);
  
  // Update UI state to show streaming
  if (dispatchUIFn) {
    dispatchUIFn({
      type: 'SET_STREAMING',
      payload: {
        isStreaming: true,
        cardId: data.cardId,
        playerId: data.playerId
      }
    });
  }
};

const handleStreamChunk = (data: {
  type: string;
  content: string;
  cardId: string;
  playerId: string;
  correlationId: string;
}) => {
  // Use stream processor to handle stream chunk
  const parsed = streamProcessor.handleStreamChunk(data);
  
  // If this is an on-play-description, add it to the game log immediately
  if (data.type === 'on-play-description') {
    addLogEntry({
      type: 'on-play-description',
      content: data.content,
      cardId: data.cardId,
      playerId: data.playerId
    });
  }
  
  // Process parsed content if available
  if (parsed) {
    processParsedStreamContent(parsed, data.cardId, data.playerId, false);
  }
};

const handleStreamEnd = (data: {
  cardId: string;
  playerId: string;
  timestamp: number;
  correlationId: string;
}) => {
  console.log(`[DEBUG] handleStreamEnd received:`, {
    cardId: data.cardId,
    playerId: data.playerId,
    timestamp: data.timestamp,
    correlationId: data.correlationId
  });
  
  // Use stream processor to handle stream end
  const parsed = streamProcessor.handleStreamEnd(data);
  
  // Process final parsed content if available
  if (parsed) {
    processParsedStreamContent(parsed, data.cardId, data.playerId, true);
  }
  
  // Update UI state to show streaming complete
  if (dispatchUIFn) {
    console.log(`[DEBUG] Setting streaming state to false in handleStreamEnd`);
    dispatchUIFn({
      type: 'SET_STREAMING',
      payload: {
        isStreaming: false,
        cardId: data.cardId,
        playerId: data.playerId
      }
    });
    
    // Turn off processing state since streaming is complete
    console.log(`[DEBUG] Setting processing state to false in handleStreamEnd`);
    dispatchUIFn({
      type: 'SET_PROCESSING',
      payload: { isProcessing: false }
    });
  } else {
    console.log(`[DEBUG] dispatchUIFn is not available in handleStreamEnd`);
  }
};

const handleStreamError = (data: {
  message: string;
  cardId?: string;
  playerId?: string;
  correlationId: string;
}) => {
  // Use stream processor to handle stream error
  streamProcessor.handleStreamError(data);
  
  if (dispatchUIFn) {
    // Show error message in log
    addLogEntry({
      type: 'error',
      content: `Error processing card: ${data.message}`,
      cardId: data.cardId,
      playerId: data.playerId
    });
    
    // Update UI state to show streaming error
    dispatchUIFn({
      type: 'SET_STREAMING',
      payload: {
        isStreaming: false,
        error: data.message
      }
    });
    
    // Turn off processing state in case of error
    dispatchUIFn({
      type: 'SET_PROCESSING',
      payload: { isProcessing: false }
    });
    
    // Show error notification
    dispatchUIFn({
      type: 'SET_ERROR',
      payload: { message: `Stream error: ${data.message}` }
    });
  }
};

// Handle game started event
const handleGameStarted = (data: { gameState: GameState, correlationId: string }) => {
  console.log('Received game-started event:', data);
  
  // Dispatch the game state update
  if (data.gameState && dispatchFn) {
    // Update the module-level gameId to the server-generated ID
    gameId = data.gameState.id;
    console.log(`Updated gameId to server-generated ID: ${gameId}`);
    
    dispatchFn({
      type: ActionType.GAME_INIT,
      payload: data.gameState,
      playerId: 'system',
      timestamp: Date.now(),
      gameId: data.gameState.id,
      validated: true
    });
    
    // Log the cards that were generated
    const playerIds = Object.keys(data.gameState.players);
    playerIds.forEach(playerId => {
      const handSize = data.gameState.players[playerId].hand?.length || 0;
      console.log(`Player ${playerId} received ${handSize} cards`);
    });
  }
};

// Set up all event handlers for socket events
const setupEventHandlers = () => {
  // Handle connection state changes
  const connectionStateSubscription = connectionManager.getConnectionState().subscribe(state => {
    handleConnectionStateChange(state);
  });
  
  // Handle game state updates
  const gameStateUnsubscribe = socketService.onGameStateUpdate(handleGameStateUpdate);
  
  // Handle game started events using the connection manager
  const gameStartedUnsubscribe = connectionManager.addEventListener('game-started', handleGameStarted);
  
  // Handle streaming events
  const streamStartUnsubscribe = socketService.onLLMStreamStart(handleStreamStart);
  const streamChunkUnsubscribe = socketService.onLLMStreamChunk(handleStreamChunk);
  const streamEndUnsubscribe = socketService.onLLMStreamEnd(handleStreamEnd);
  const streamErrorUnsubscribe = socketService.onLLMStreamError(handleStreamError);
  
  // Handle action received events
  const actionReceivedUnsubscribe = socketService.onActionReceived((data) => {
    console.log("action-received", data);
  });
  
  // Return cleanup function
  return () => {
    connectionStateSubscription.unsubscribe();
    gameStateUnsubscribe();
    gameStartedUnsubscribe(); // Using the proper unsubscribe function
    actionReceivedUnsubscribe();
    streamStartUnsubscribe();
    streamChunkUnsubscribe();
    streamEndUnsubscribe();
    streamErrorUnsubscribe();
    
    if (gameId) {
      socketService.leaveGameRoom(gameId);
    }
    
    socketService.disconnectSocket();
  };
};

// Initialize the game sync
const initialize = (gameState: GameState, dispatch: any, dispatchUI: any) => {
  // Set the game ID first and log it
  gameId = gameState.id;
  console.log(`Initializing game sync with game ID: ${gameId}`);
  
  // Only set dispatch functions if they're provided
  if (dispatch) dispatchFn = dispatch;
  if (dispatchUI) dispatchUIFn = dispatchUI;
  
  // Connect after initializing
  const socket = socketService.initSocket();
  if (!socket.connected) {
    socket.connect();
  }
  
  // Clean up any existing handlers
  if (cleanupHandlers) {
    cleanupHandlers();
  }
  
  // Set up event handlers
  cleanupHandlers = setupEventHandlers();
  
  // Join the game room if we have a game ID
  if (gameId) {
    console.log(`Joining game room for game ID: ${gameId}`);
    socketService.joinGameRoom(gameId, '');
  }
};

// Export the game sync functions
export const gameSync = {
  sendAction,
  initialize,
  get connectionState() {
    // Access the current connection state from the connection manager
    return connectionManager.getCurrentState();
  },
  get streamingState() {
    // Access the current streaming state from the stream processor
    return streamProcessor.getCurrentState();
  }
};

/**
 * Custom hook for using game sync in React components
 * This provides reactive state updates when connection or streaming state changes
 */
function useGameSync() {
  // Get reactive connection state
  const connectionState = useSubscription(
    connectionManager.getConnectionState(), 
    'disconnected'
  );
  
  // Get reactive streaming state
  const streamingState = useSubscription(
    streamProcessor.getStreamingState(), 
    {
      isStreaming: false,
      streamContent: '',
      streamComplete: false
    }
  );
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (cleanupHandlers) {
        cleanupHandlers();
      }
    };
  }, []);
  
  // Return the gameSync object plus reactive state
  return {
    ...gameSync,
    connectionState,
    streamingState
  };
}

export default useGameSync;
