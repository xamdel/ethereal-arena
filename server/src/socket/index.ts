/**
 * Socket Server Initialization and Setup
 */
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { registerConnectionHandlers } from './connectionHandlers';
import { registerGameHandlers } from './gameHandlers';
import { handleGenerateCharacter } from './characterHandlers'; // Added import
import { CharacterGenerationRequest } from '../types/character'; // Added import

// Define allowed origins based on environment variables or defaults
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:5173' // Vite dev server default
];

export function initializeSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Register handlers for this connection
    registerConnectionHandlers(io, socket);
    registerGameHandlers(io, socket);

    // Character generation handler
    socket.on('generateCharacter', (data: CharacterGenerationRequest) => {
      handleGenerateCharacter(io, socket, data);
    });

    // Centralized disconnect handler (moved from connectionHandlers)
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      // If the client was in a game, notify others
      const gameId = socket.data.gameId;
      const playerId = socket.data.playerId;

      if (gameId && playerId) {
        socket.to(gameId).emit('player-disconnected', {
          socketId: socket.id,
          playerId: playerId
        });
        // In a production implementation, we might mark the player as inactive
        // or handle reconnection logic
        console.log(`[Socket.IO] Notified game ${gameId} about player ${playerId} disconnect`);
      }
    });
  });

  console.log('[Socket.IO] Server initialized and connection handler registered.');
  return io;
}
