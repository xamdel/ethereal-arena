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
    console.log(`[DEBUG] Processing queued message for ${message.action.type}`, {
      correlationId: message.action.correlationId,
      isStreamAction: message.isStreamAction
    });
    
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
 * Create and start a game using the socket 'start-game' event
 * This combines the functionality of the former createGame API and startGame
 * @param gameId The temporary game ID (will be replaced by server-generated ID)
 * @param playerId The player ID initiating the start
 * @param playerName Optional player name (defaults to 'Player')
 * @param isSinglePlayer Whether this is a single-player game (defaults to true)
 */
export const startGame = (
  gameId: string, 
  playerId: string, 
  playerName: string = 'Player', 
  isSinglePlayer: boolean = true
): Promise<any> => {
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
    
    // Send the start-game event with all necessary params for game creation
    console.log(`Sending start-game event for new game with player ${playerId}`);
    socket.emit('start-game', {
      gameId,
      playerId,
      playerName,
      isSinglePlayer,
      correlationId
    });
  });
};

/**
 * Join an existing game
 * @param gameId The game to join
 * @param playerId The player's ID
 * @param playerName The player's name
 */
export const joinGame = (
  gameId: string, 
  playerId: string, 
  playerName: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!socket) {
      socket = initSocket();
      if (!socket.connected) {
        socket.connect();
      }
    }
    
    const correlationId = generateUUID();
    const timeoutDuration = ACK_TIMEOUT;
    
    // Function to handle game join events
    const onGameJoined = (data: any) => {
      if (data.correlationId === correlationId) {
        connectionManager.removeEventListener('game-joined', onGameJoined);
        clearTimeout(timeout);
        
        console.log('Joined game successfully:', {
          gameId: data.gameState.id,
          playerCount: Object.keys(data.gameState.players).length
        });
        
        resolve(data);
      }
    };
    
    // Set timeout to avoid hanging forever
    const timeout = setTimeout(() => {
      connectionManager.removeEventListener('game-joined', onGameJoined);
      reject(new Error(`Join game request timed out after ${timeoutDuration}ms`));
    }, timeoutDuration);
    
    // Listen for the response
    connectionManager.addEventListener('game-joined', onGameJoined);
    
    // Send the join-game event with player info
    console.log(`Sending join-game event for game ${gameId}`);
    socket.emit('join-game', {
      gameId,
      playerId,
      playerName,
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
    // Log the gameId for debugging
    console.log(`Sending game action to gameId: ${gameId}`);
    
    // Check if socket has a different gameId stored in socket.data
    if (socket?.data?.gameId && socket.data.gameId !== gameId) {
      console.warn(`Socket has different gameId (${socket.data.gameId}) than provided (${gameId}). Using socket's gameId.`);
      gameId = socket.data.gameId;
    }
    
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

  console.log(`[DEBUG] sendActionWithAck: ${action.type}`, { 
    correlationId,
    isStreamAction,
    timeoutDuration,
    actionPayload: action.payload
  });

  const timeout = setTimeout(() => {
    const pendingAction = pendingActions.get(correlationId);
    if (pendingAction) {
      console.log(`[DEBUG] Action timed out after ${timeoutDuration}ms`, { 
        correlationId,
        actionType: action.type,
        isStreamAction,
        pendingActionsSize: pendingActions.size
      });
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

  console.log(`[DEBUG] Added pendingAction for ${action.type}`, { 
    correlationId,
    isStreamAction,
    pendingActionsSize: pendingActions.size
  });

  if (connectionManager.getCurrentState() === "connected" && socket?.connected) {
    console.log(`[DEBUG] Emitting game-action event for ${action.type}`, { 
      correlationId,
      connectionState: connectionManager.getCurrentState(),
      isStreamAction
    });
    
    // Pass the streamResponse flag directly to the server
    socket.emit('game-action', { 
      gameId, 
      action, 
      correlationId,
      streamResponse: isStreamAction 
    });
  } else {
    console.log(`[DEBUG] Adding to message queue - not connected`, { 
      correlationId,
      connectionState: connectionManager.getCurrentState(),
      queueLength: messageQueue.length
    });
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
    console.log(`[DEBUG] Socket event received: ${event}`, { 
      hasCorrelationId: !!data.correlationId,
      correlationId: data.correlationId,
      eventType: event,
      isPendingAction: data.correlationId ? pendingActions.has(data.correlationId) : false
    });

    // If the event contains a correlationId, resolve the corresponding pending action
    if (handleCorrelation && data.correlationId) {
      const pendingAction = pendingActions.get(data.correlationId);
      if (pendingAction) {
        console.log(`[DEBUG] Found pending action for correlationId: ${data.correlationId}`, { 
          isStreamAction: pendingAction.isStreamAction,
          eventType: event
        });
        
        // For streaming actions, we only resolve on stream-end
        if (!pendingAction.isStreamAction || event === 'llm-stream-end') {
          console.log(`[DEBUG] Resolving promise for correlationId: ${data.correlationId}`);
          clearTimeout(pendingAction.timeout);
          pendingActions.delete(data.correlationId);
          pendingAction.resolve(data);
        } else if (event === 'llm-stream-error') {
          console.log(`[DEBUG] Rejecting promise for correlationId: ${data.correlationId} due to stream error`);
          clearTimeout(pendingAction.timeout);
          pendingActions.delete(data.correlationId);
          pendingAction.reject(new Error((data as any).message));
        } else {
          console.log(`[DEBUG] Not resolving promise yet for correlationId: ${data.correlationId} (waiting for llm-stream-end)`);
        }
      } else {
        console.log(`[DEBUG] No pending action found for correlationId: ${data.correlationId}`);
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
