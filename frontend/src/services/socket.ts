/**
 * WebSocket client for real-time communication with the server
 */

import { io, Socket } from 'socket.io-client';
import { GameAction, GameState } from '@/types';

// WebSocket server URL from environment variable or default to localhost
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

/**
 * Initialize WebSocket connection
 */
export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    // Set up default event listeners
    socket.on('connect', () => {
      console.log('Connected to game server');
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from game server');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }
  
  return socket;
};

/**
 * Join a game room
 * @param gameId The game to join
 */
export const joinGameRoom = (gameId: string): void => {
  if (!socket) {
    socket = initSocket();
  }
  
  socket.emit('join-game', gameId);
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
export const sendGameAction = (gameId: string, action: GameAction): void => {
  if (!socket) {
    socket = initSocket();
  }
  
  socket.emit('game-action', { gameId, action });
};

/**
 * Subscribe to action received events
 * @param callback Function to call when a new action is received
 */
export const onActionReceived = (callback: (data: { action: GameAction }) => void): void => {
  if (!socket) {
    socket = initSocket();
  }
  
  socket.on('action-received', callback);
};

/**
 * Subscribe to game state update events
 * @param callback Function to call when the game state is updated
 */
export const onGameStateUpdate = (callback: (data: { gameState: GameState }) => void): void => {
  if (!socket) {
    socket = initSocket();
  }
  
  socket.on('game-state-update', callback);
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
  }
};