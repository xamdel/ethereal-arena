/**
 * WebSocket client for real-time communication with the server
 * Uses ConnectionManager for centralized connection state management
 */

import { io, Socket } from 'socket.io-client';
import { GameAction, GameState } from '@/types';
import { connectionManager } from './connection-manager';

// WebSocket server URL from environment variable or default to localhost
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// Timeouts
const ACK_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_SOCKET_ACK_TIMEOUT || "15000");
const STREAM_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_SOCKET_STREAM_TIMEOUT || "15000");

let socket: Socket | null = null;

// Message queue system
const pendingActions = new Map<string, { 
  resolve: (data: any) => void; 
  reject: (error: Error) => void; 
  timeout: NodeJS.Timeout;
  isStreamAction: boolean;
}>();

const messageQueue: any[] = [];

// Reconnection settings
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_MULTIPLIER = 1.5;

function processMessageQueue() {
  if (connectionManager.getCurrentState() === "connected" && messageQueue.length > 0) {
    const message = messageQueue.shift();
    sendActionWithAck(
      message.action, 
      message.gameId, 
      message.resolve, 
      message.reject, 
      message.isStreamAction
    );
    processMessageQueue(); // Continue processing
  }
}

function handleReconnection() {
  if (connectionManager.getCurrentState() === "reconnecting") {
    // Already in reconnection process
    return;
  }
  
  let currentAttempt = 0;
  
  function attemptReconnect() {
    if (currentAttempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error("Max reconnection attempts reached.");
      return;
    }
    
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(RECONNECT_MULTIPLIER, currentAttempt),
      MAX_RECONNECT_DELAY
    );
    
    setTimeout(() => {
      currentAttempt++;
      console.log(`Attempting to reconnect (attempt ${currentAttempt})...`);
      if (socket) {
        socket.connect();
      }
      
      // If still not connected after connect attempt, try again
      if (connectionManager.getCurrentState() !== "connected") {
        attemptReconnect();
      }
    }, delay);
  }
  
  attemptReconnect();
}

/**
 * Initialize WebSocket connection
 */
export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false, // Control connection manually
      reconnection: false, // We'll handle reconnection manually
    });
    
    // Set the socket in connection manager
    connectionManager.setSocket(socket);
    
    // Set up ping-pong for connection health checks
    setInterval(() => {
      if (socket && connectionManager.getCurrentState() === "connected") {
        socket.emit('ping');
      }
    }, 15000);
    
    socket.on('pong', () => {
      // console.log('Received pong from server'); // For debugging
    });
    
    // Setup reconnection logic
    socket.on('disconnect', handleReconnection);
    socket.on('connect_error', handleReconnection);
    
    // Add server error handler
    socket.on('error', (errorData) => {
      console.error('Socket server error:', errorData);
    });
    
    // Handle connection changes
    socket.on('connect', () => {
      processMessageQueue();
    });
  }

  return socket;
};

/**
 * Join a game room
 * @param gameId The game to join
 * @param playerId The player's ID
 */
export const joinGameRoom = (gameId: string, playerId: string): void => {
  if (!socket) {
    socket = initSocket();
  }
  
  if (socket && !socket.connected) {
    socket.connect();
  }

  socket.emit('join-game', { gameId, playerId });
};

/**
 * Leave the current game room
 * @param gameId The game to leave
 */
export const leaveGameRoom = (gameId: string): void => {
  if (socket) {
    socket.emit('leave-game', gameId);
  }
};

/**
 * Start a game using the socket 'start-game' event
 * @param gameId The game ID to start
 * @param playerId The player ID initiating the start
 */
export const startGame = (gameId: string, playerId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!socket) {
      socket = initSocket();
      if (!socket.connected) {
        socket.connect();
      }
    }
    
    const correlationId = generateUUID();
    const timeoutDuration = ACK_TIMEOUT;
    
    // Function to handle game started events
    const onGameStarted = (data: any) => {
      if (data.correlationId === correlationId) {
        // Use connection manager to properly unregister
        connectionManager.removeEventListener('game-started', onGameStarted);
        clearTimeout(timeout);
        
        console.log('Game started successfully:', {
          playerCount: Object.keys(data.gameState.players).length,
          cardsInHand: data.gameState.players[playerId]?.hand?.length || 0
        });
        
        resolve(data);
      }
    };
    
    // Set timeout to avoid hanging forever
    const timeout = setTimeout(() => {
      connectionManager.removeEventListener('game-started', onGameStarted);
      reject(new Error(`Game start request timed out after ${timeoutDuration}ms`));
    }, timeoutDuration);
    
    // Listen for the response using connection manager
    connectionManager.addEventListener('game-started', onGameStarted);
    
    // Send the start-game event
    console.log(`Sending start-game event for game ${gameId}`);
    socket.emit('start-game', {
      gameId,
      playerId,
      correlationId
    });
  });
};

/**
 * Generate a unique UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Send a game action via WebSocket
 * @param gameId The game identifier
 * @param action The action to send
 * @param options Additional options
 */
export const sendGameAction = (
  gameId: string, 
  action: GameAction, 
  options: { streamResponse?: boolean } = {}
): Promise<any> => {
  return new Promise((resolve, reject) => {
    sendActionWithAck(action, gameId, resolve, reject, options.streamResponse);
  });
};

const sendActionWithAck = (
  action: any, 
  gameId: string, 
  resolve: (value: unknown) => void, 
  reject: (reason?: any) => void,
  isStreamAction = false
) => {
  if (!socket) {
    socket = initSocket();
  }

  const correlationId = action.correlationId || generateUUID();
  action.correlationId = correlationId;
  
  const timeoutDuration = isStreamAction ? STREAM_TIMEOUT : ACK_TIMEOUT;

  const timeout = setTimeout(() => {
    const pendingAction = pendingActions.get(correlationId);
    if (pendingAction) {
      pendingActions.delete(correlationId);
      reject(new Error(`Action timed out after ${timeoutDuration}ms`));
    }
  }, timeoutDuration);

  pendingActions.set(correlationId, { 
    resolve, 
    reject, 
    timeout,
    isStreamAction
  });

  if (connectionManager.getCurrentState() === "connected" && socket?.connected) {
    socket.emit('game-action', { gameId, action, correlationId });
  } else {
    messageQueue.push({ action, gameId, resolve, reject, isStreamAction });
    if (connectionManager.getCurrentState() !== "reconnecting") {
      handleReconnection();
    }
  }
};

// Register event handlers with proper cleanup
function registerSocketEvent<T>(
  event: string,
  callback: (data: T) => void,
  handleCorrelation = false
) {
  if (!socket) {
    socket = initSocket();
  }
  
  const eventHandler = (data: T & { correlationId?: string }) => {
    // If the event contains a correlationId, resolve the corresponding pending action
    if (handleCorrelation && data.correlationId) {
      const pendingAction = pendingActions.get(data.correlationId);
      if (pendingAction) {
        // For streaming actions, we only resolve on stream-end
        if (!pendingAction.isStreamAction || event === 'llm-stream-end') {
          clearTimeout(pendingAction.timeout);
          pendingActions.delete(data.correlationId);
          pendingAction.resolve(data);
        } else if (event === 'llm-stream-error') {
          clearTimeout(pendingAction.timeout);
          pendingActions.delete(data.correlationId);
          pendingAction.reject(new Error((data as any).message));
        }
      }
    }
    
    // Call the user's callback
    callback(data);
  };
  
  return connectionManager.addEventListener(event, eventHandler);
}

/**
 * Subscribe to game state update events
 * @param callback Function to call when the game state is updated
 */
export const onGameStateUpdate = (
  callback: (data: { gameState: GameState; correlationId: string }) => void
): () => void => {
  return registerSocketEvent('game-state-update', callback, true);
};

/**
 * Subscribe to action received events
 * @param callback Function to call when a new action is received
 */
export const onActionReceived = (
  callback: (data: { action: GameAction; correlationId: string }) => void
): () => void => {
  return registerSocketEvent('action-received', callback, true);
};

/**
 * Subscribe to LLM stream start events
 * @param callback Function to call when an LLM stream starts
 */
export const onLLMStreamStart = (
  callback: (data: {
    cardId: string;
    playerId: string;
    timestamp: number;
    correlationId: string;
  }) => void
): () => void => {
  return registerSocketEvent('llm-stream-start', callback);
};

/**
 * Subscribe to LLM stream chunk events
 * @param callback Function to call when an LLM stream chunk is received
 */
export const onLLMStreamChunk = (
  callback: (data: {
    type: string;
    content: string;
    cardId: string;
    playerId: string;
    correlationId: string;
  }) => void
): () => void => {
  return registerSocketEvent('llm-stream-chunk', callback);
};

/**
 * Subscribe to LLM stream end events
 * @param callback Function to call when an LLM stream ends
 */
export const onLLMStreamEnd = (
  callback: (data: {
    cardId: string;
    playerId: string;
    timestamp: number;
    correlationId: string;
  }) => void
): () => void => {
  return registerSocketEvent('llm-stream-end', callback, true);
};

/**
 * Subscribe to LLM stream error events
 * @param callback Function to call when an LLM stream errors
 */
export const onLLMStreamError = (
  callback: (data: {
    message: string;
    cardId?: string;
    playerId?: string;
    correlationId: string;
  }) => void
): () => void => {
  return registerSocketEvent('llm-stream-error', callback, true);
};

/**
 * Subscribe to player join events
 * @param callback Function to call when a new player joins
 */
export const onPlayerJoined = (
  callback: (data: { socketId: string }) => void
): () => void => {
  return registerSocketEvent('player-joined', callback);
};

/**
 * Disconnect from the server
 */
export const disconnectSocket = (): void => {
  if (socket) {
    connectionManager.clearEventListeners();
    socket.disconnect();
    socket = null;
  }
};
