/**
 * Socket Handlers for Connection and Room Management
 */
import { Server as SocketIOServer, Socket } from 'socket.io';
import { getGameSession, addPlayerToSession } from '../game-engine/game-session-manager'; // Use direct imports

export function registerConnectionHandlers(io: SocketIOServer, socket: Socket): void {

  // Join a game room
  socket.on('join-game', (data) => {
    const { gameId, playerId, playerName, correlationId } = data;

    if (!gameId) {
      socket.emit('error', { message: 'Game ID is required' });
      return;
    }

    // If we have playerName, this is a full join operation (not just a reconnect)
    if (playerName && playerId) {
      try {
        console.log(`[Socket.IO] Client ${socket.id} joining existing game: ${gameId} as player ${playerId} (${playerName})`);

        // Add the player to the game session
        const updatedSession = addPlayerToSession(gameId, playerId, playerName);

        if (!updatedSession) {
          socket.emit('error', { message: 'Game not found or cannot join' });
          return;
        }

        socket.join(gameId);

        // Store the player ID in the socket data
        socket.data.playerId = playerId;
        socket.data.gameId = gameId;

        // Notify all clients about the joined player
        io.to(gameId).emit('player-joined', {
          socketId: socket.id,
          playerId: playerId,
          playerName: playerName
        });

        // Send the updated game state to the joining client
        socket.emit('game-joined', {
          gameState: updatedSession.gameState,
          correlationId: correlationId
        });

        // Broadcast updated game state to all players
        io.to(gameId).emit('game-state-update', {
          gameState: updatedSession.gameState,
          correlationId: correlationId
        });
      }
      catch (error) {
        console.error(`[Socket.IO] Error joining game:`, error);
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Unknown error joining game'
        });
      }
    }
    // Simple room join (for reconnections)
    else {
      socket.join(gameId);
      console.log(`[Socket.IO] Client ${socket.id} reconnected to game: ${gameId}`);

      // Store the player ID in the socket data if provided
      if (playerId) {
        socket.data.playerId = playerId;
        socket.data.gameId = gameId;

        // Notify other players in the room
        socket.to(gameId).emit('player-reconnected', { // Use a different event for reconnect?
          socketId: socket.id,
          playerId: playerId
        });
      }
    }
  });

  // Note: The 'disconnect' handler is now centralized in socket/index.ts
}
