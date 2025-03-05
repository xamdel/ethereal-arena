import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';

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
  socket.on('game-action', (data) => {
    const { gameId, action } = data;
    
    if (!gameId || !action) {
      socket.emit('error', { message: 'Invalid action data' });
      return;
    }
    
    // Process the action using the game engine
    const gameEngine = require('./game-engine');
    const result = gameEngine.processAction(gameId, action);
    
    if (!result.session) {
      socket.emit('error', { 
        message: result.error || 'Failed to process action' 
      });
      return;
    }
    
    // Broadcast the updated game state to all clients in the room
    io.to(gameId).emit('game-state-update', { 
      gameState: result.session.gameState,
      action: action
    });
  });
  
  // Handle start game request
  socket.on('start-game', (data) => {
    const { gameId } = data;
    
    if (!gameId) {
      socket.emit('error', { message: 'Game ID is required' });
      return;
    }
    
    // Start the game using the game engine
    const gameEngine = require('./game-engine');
    const startedSession = gameEngine.startGame(gameId);
    
    if (!startedSession) {
      socket.emit('error', { message: 'Failed to start game' });
      return;
    }
    
    // Broadcast the game start and updated state
    io.to(gameId).emit('game-started', {
      gameState: startedSession.gameState
    });
  });
  
  // Handle select cards request
  socket.on('select-cards', (data) => {
    const { gameId, playerId, selectedCardIds } = data;
    
    if (!gameId || !playerId || !selectedCardIds) {
      socket.emit('error', { message: 'Invalid card selection data' });
      return;
    }
    
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
    
    // Process the action
    const result = gameEngine.processAction(gameId, selectAction);
    
    if (!result.session) {
      socket.emit('error', { 
        message: result.error || 'Failed to select cards' 
      });
      return;
    }
    
    // Broadcast the updated game state
    io.to(gameId).emit('game-state-update', { 
      gameState: result.session.gameState,
      action: selectAction
    });
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