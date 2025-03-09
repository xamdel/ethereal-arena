/**
 * WebSocket client for real-time communication with the server
 */

import { io, Socket } from 'socket.io-client';
import { GameAction, GameState } from '@/types';

// WebSocket server URL from environment variable or default to localhost
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// Timeouts
const ACK_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_SOCKET_ACK_TIMEOUT || "5000");
const STREAM_TIMEOUT = parseInt(process.env.NEXT_PUBLIC_SOCKET_STREAM_TIMEOUT || "15000");

let socket: Socket | null = null;

// Connection state tracking
type ConnectionState = "connected" | "disconnected" | "reconnecting";
let connectionState: ConnectionState = "disconnected";

// Message queue system
const pendingActions = new Map<string, { resolve: (data: any) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }>();
const messageQueue: any[] = [];

// Reconnection logic
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_MULTIPLIER = 1.5;

function processMessageQueue() {
    if (connectionState === "connected" && messageQueue.length > 0) {
        const message = messageQueue.shift();
        sendActionWithAck(message.action, message.gameId, message.resolve, message.reject);
        processMessageQueue(); // Continue processing
    }
}

/**
 * Initialize WebSocket connection
 */
export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false, // Control connection manually for better state management
      reconnection: false, // We'll handle reconnection manually
    });

    // Set up default event listeners
    socket.on('connect', () => {
      console.log('Connected to game server');
      connectionState = "connected";
      reconnectAttempts = 0; // Reset on successful connection
      processMessageQueue();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from game server');
      connectionState = "disconnected";
      attemptReconnect();
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      attemptReconnect();
    });

    // Add socket error handler for socket server errors
    socket.on('error', (errorData) => {
      console.error('Socket server error:', errorData);
    });

    // Ping-pong for connection health checks (optional, server must support)
    setInterval(() => {
      if (socket && connectionState === "connected") {
        socket.emit('ping');
      }
    }, 15000);

    socket.on('pong', () => {
      // console.log('Received pong from server'); // For debugging
    });
  }

  return socket;
};

function attemptReconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectionState = "reconnecting";
        const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(RECONNECT_MULTIPLIER, reconnectAttempts), MAX_RECONNECT_DELAY);
        setTimeout(() => {
            reconnectAttempts++;
            console.log(`Attempting to reconnect (attempt ${reconnectAttempts})...`);
            if (socket) {
                socket.connect();
            }
        }, delay);
    } else {
        console.error("Max reconnection attempts reached.");
        connectionState = "disconnected";
        // Consider showing a "Connection lost" message to the user
    }
}

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
 * Send a game action via WebSocket
 * @param gameId The game identifier
 * @param action The action to send
 */
export const sendGameAction = (gameId: string, action: GameAction): Promise<any> => {
    return new Promise((resolve, reject) => {
        sendActionWithAck(action, gameId, resolve, reject);
    });
};

const sendActionWithAck = (action: any, gameId: string, resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
    if (!socket) {
        socket = initSocket();
    }

    const correlationId = generateUUID(); // Simple UUID generation
    const timeoutDuration = action.streamResponse ? STREAM_TIMEOUT : ACK_TIMEOUT;

    const timeout = setTimeout(() => {
        pendingActions.delete(correlationId);
        reject(new Error(`Action timed out after ${timeoutDuration}ms`));
    }, timeoutDuration);

    pendingActions.set(correlationId, { resolve, reject, timeout });

    if (connectionState === "connected" && socket?.connected) {
        socket.emit('game-action', { gameId, action, correlationId });
    } else {
        messageQueue.push({ action, gameId, resolve, reject });
        if (connectionState !== "reconnecting") {
          attemptReconnect();
        }
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Subscribe to action received events
 * @param callback Function to call when a new action is received
 */
export const onActionReceived = (callback: (data: { action: GameAction; correlationId: string }) => void): void => {
  if (!socket) {
    socket = initSocket();
  }

  socket.on('action-received', (data) => {
    const { correlationId } = data;
    if (correlationId) {
      const pendingAction = pendingActions.get(correlationId);
      if (pendingAction) {
        clearTimeout(pendingAction.timeout);
        pendingActions.delete(correlationId);
        pendingAction.resolve(data); // Resolve the promise
      }
    }
    callback(data)
  });
};

/**
 * Subscribe to game state update events
 * @param callback Function to call when the game state is updated
 */
export const onGameStateUpdate = (callback: (data: { gameState: GameState; correlationId: string }) => void): void => {
  if (!socket) {
    socket = initSocket();
  }

  socket.on('game-state-update', callback);
};

/**
 * Subscribe to LLM stream start events
 * @param callback Function to call when an LLM stream starts
 */
export const onLLMStreamStart = (callback: (data: {
  cardId: string;
  playerId: string;
  timestamp: number;
  correlationId: string;
}) => void): void => {
  if (!socket) {
    socket = initSocket();
  }

  socket.on('llm-stream-start', callback);
};

/**
 * Subscribe to LLM stream chunk events
 * @param callback Function to call when an LLM stream chunk is received
 */
export const onLLMStreamChunk = (callback: (data: {
  type: string;
  content: string;
  cardId: string;
  playerId: string;
  correlationId: string;
}) => void): void => {
  if (!socket) {
    socket = initSocket();
  }

  socket.on('llm-stream-chunk', (data) => {
    const { correlationId } = data;

    // Check if this chunk is part of a pending action
    if (correlationId) {
      const pendingAction = pendingActions.get(correlationId);
      if (pendingAction) {
        // Don't resolve yet, just process the chunk
        // The final resolution will happen on stream end or a full response
        callback(data);
      }
    } else {
      callback(data);
    }
  });
};

/**
 * Subscribe to LLM stream end events
 * @param callback Function to call when an LLM stream ends
 */
export const onLLMStreamEnd = (callback: (data: {
  cardId: string;
  playerId: string;
  timestamp: number;
  correlationId: string;
}) => void): void => {
  if (!socket) {
    socket = initSocket();
  }

  socket.on('llm-stream-end', (data) => {
    const { correlationId } = data;
    if (correlationId) {
      const pendingAction = pendingActions.get(correlationId);
      if (pendingAction) {
        clearTimeout(pendingAction.timeout);
        pendingActions.delete(correlationId);
        pendingAction.resolve(data); // Resolve the promise
      }
    }
    callback(data);
  });
};

/**
 * Subscribe to LLM stream error events
 * @param callback Function to call when an LLM stream errors
 */
export const onLLMStreamError = (callback: (data: {
  message: string;
  cardId?: string;
  playerId?: string;
  correlationId: string;
}) => void): void => {
  if (!socket) {
    socket = initSocket();
  }

  socket.on('llm-stream-error', (data) => {
    const { correlationId } = data;
    if (correlationId) {
      const pendingAction = pendingActions.get(correlationId);
      if (pendingAction) {
        clearTimeout(pendingAction.timeout);
        pendingActions.delete(correlationId);
        pendingAction.reject(new Error(data.message)); // Reject the promise
      }
    }
    callback(data);
  });
};

/**
 * Subscribe to player join events
 * @param callback Function to call when a new player joins
 */
export const onPlayerJoined = (callback: (data: { socketId: string }) => void): void => {
  if (!socket) {
    socket = initSocket();
  }

  socket.on('player-joined', callback);
};

/**
 * Disconnect from the server
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectionState = "disconnected";
  }
};
