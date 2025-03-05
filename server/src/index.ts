import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';
import llmApiRoutes from './routes/llm-api';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api', apiRoutes);
app.use('/api/llm', llmApiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Ethereal Arena Game Server' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Join a game room
  socket.on('join-game', (data) => {
    const { gameId, playerId } = data;
    
    if (!gameId) {
      socket.emit('error', { message: 'Game ID is required' });
      return;
    }
    
    socket.join(gameId);
    console.log(`Client ${socket.id} joined game: ${gameId}`);
    
    // Store the player ID in the socket data
    socket.data.playerId = playerId;
    socket.data.gameId = gameId;
    
    // Notify other players in the room
    socket.to(gameId).emit('player-joined', { 
      socketId: socket.id,
      playerId: playerId
    });
  });
  
  // Handle game actions
  socket.on('game-action', async (data) => {
    const { gameId, action } = data;
    
    if (!gameId || !action) {
      socket.emit('error', { message: 'Invalid action data' });
      return;
    }
    
    try {
      console.log(`[Socket.IO] Received ${action.type} action for game ${gameId}`);
      
      // Process the action using the game engine - now async
      const gameEngine = require('./game-engine');
      const result = await gameEngine.processAction(gameId, action);
      
      if (!result.session) {
        console.error(`[Socket.IO] Error processing action: ${result.error}`);
        socket.emit('error', { 
          message: result.error || 'Failed to process action' 
        });
        return;
      }
      
      console.log(`[Socket.IO] Action processed successfully, broadcasting update`);
      
      // Broadcast the updated game state to all clients in the room
      io.to(gameId).emit('game-state-update', { 
        gameState: result.session.gameState,
        action: action
      });
    } catch (error) {
      console.error(`[Socket.IO] Error processing action:`, error);
      socket.emit('error', { 
        message: error instanceof Error ? error.message : 'Unknown error processing action'
      });
    }
  });
  
  // Handle start game request
  socket.on('start-game', async (data) => {
    const { gameId } = data;
    
    if (!gameId) {
      socket.emit('error', { message: 'Game ID is required' });
      return;
    }
    
    try {
      console.log(`[Socket.IO] Starting game ${gameId}`);
      
      // Start the game using the game engine - now async
      const gameEngine = require('./game-engine');
      const startedSession = await gameEngine.startGame(gameId);
      
      if (!startedSession) {
        console.error(`[Socket.IO] Failed to start game ${gameId}`);
        socket.emit('error', { message: 'Failed to start game' });
        return;
      }
      
      console.log(`[Socket.IO] Game ${gameId} started successfully`);
      
      // Broadcast the game start and updated state
      io.to(gameId).emit('game-started', {
        gameState: startedSession.gameState
      });
    } catch (error) {
      console.error(`[Socket.IO] Error starting game:`, error);
      socket.emit('error', { 
        message: error instanceof Error ? error.message : 'Unknown error starting game'
      });
    }
  });
  
  // Handle select cards request
  socket.on('select-cards', async (data) => {
    const { gameId, playerId, selectedCardIds } = data;
    
    if (!gameId || !playerId || !selectedCardIds) {
      socket.emit('error', { message: 'Invalid card selection data' });
      return;
    }
    
    try {
      console.log(`[Socket.IO] Selecting cards for player ${playerId} in game ${gameId}`);
      
      // Create a select cards action
      const gameEngine = require('./game-engine');
      const { v4: uuidv4 } = require('uuid');
      
      const selectAction = {
        id: uuidv4(),
        type: 'SELECT_CARDS',
        playerId: playerId,
        payload: { selectedCardIds },
        timestamp: Date.now(),
        gameId: gameId,
        validated: false
      };
      
      // Process the action - now async
      console.log(`[Socket.IO] Processing select cards action`);
      const result = await gameEngine.processAction(gameId, selectAction);
      
      if (!result.session) {
        console.error(`[Socket.IO] Error selecting cards: ${result.error}`);
        socket.emit('error', { 
          message: result.error || 'Failed to select cards' 
        });
        return;
      }
      
      console.log(`[Socket.IO] Cards selected successfully, broadcasting update`);
      
      // Broadcast the updated game state
      io.to(gameId).emit('game-state-update', { 
        gameState: result.session.gameState,
        action: selectAction
      });
    } catch (error) {
      console.error(`[Socket.IO] Error selecting cards:`, error);
      socket.emit('error', { 
        message: error instanceof Error ? error.message : 'Unknown error selecting cards'
      });
    }
  });
  
  // Handle disconnections
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
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
    }
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});