import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';
import llmApiRoutes from './routes/llm-api';
import { Socket } from 'socket.io';
import { GameAction } from './types';

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
      
      // Check if this is a card play action with streaming enabled
      if (action.type === 'PLAY_CARD' && action.payload?.streamResponse === true) {
        // Handle streaming card play
        await handleStreamingCardPlay(socket, gameId, action);
      } else {
        // Process the action normally using the game engine
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
      }
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

// Helper function to handle streaming card play
async function handleStreamingCardPlay(socket: Socket, gameId: string, action: GameAction) {
  try {
    console.log(`[Socket.IO] Handling streaming card play for game ${gameId}`);
    console.log(`[Socket.IO] Action details:`, JSON.stringify({
      type: action.type,
      playerId: action.playerId,
      payload: action.payload,
      id: action.id
    }));
    
    // Get the session first to validate the action
    const gameEngine = require('./game-engine');
    const { gameSessionManager } = gameEngine;
    const session = gameSessionManager.getSession(gameId);
    
    if (!session) {
      console.error(`[Socket.IO] Game session ${gameId} not found`);
      socket.emit('error', { message: 'Game session not found' });
      return;
    }
    
    // Get card and player information from the action
    const { cardId, playerId, targetId } = action.payload;
    const card = session.gameState.players[playerId]?.hand?.find(c => c.id === cardId);
    
    if (!card) {
      console.error(`[Socket.IO] Card ${cardId} not found in player ${playerId}'s hand`);
      socket.emit('error', { message: 'Card not found in player hand' });
      return;
    }
    
    console.log(`[Socket.IO] Playing card "${card.name}" (${cardId}) for player ${playerId}`);
    
    // Send the on_play_description immediately if available
    if (card.on_play_description) {
      // Process any placeholders in the description
      let description = card.on_play_description;
      description = description.replace(/\[player\]/g, session.gameState.players[playerId]?.name || 'You');
      description = description.replace(/\[opponent\]/g, 
        Object.values(session.gameState.players).find(p => p.id !== playerId)?.name || 'opponent');
      
      console.log(`[Socket.IO] Sending immediate on_play_description: "${description}"`);
      
      // Emit the immediate description
      io.to(gameId).emit('llm-stream-chunk', {
        type: 'on-play-description',
        content: description,
        cardId,
        playerId
      });
    }
    
    // Import LLM service to create the stream
    const { llmService } = require('./game-engine/llm-service');
    
    console.log(`[Socket.IO] Creating card effects stream for card ${cardId}`);
    
    // Create the stream
    const stream = await llmService.createCardEffectsStream(
      card,
      playerId,
      session.gameState,
      gameId,
      targetId
    );
    
    console.log(`[Socket.IO] Stream created successfully, emitting stream-start event`);
    
    // Start the streaming event
    io.to(gameId).emit('llm-stream-start', {
      cardId,
      playerId,
      timestamp: Date.now()
    });
    
    let chunkCount = 0;
    let totalContent = '';
    
    // Stream chunks to the client
    try {
      console.log(`[Socket.IO] Beginning to process stream chunks`);
      
      for await (const chunk of stream) {
        // Safely check for content and log each chunk for debugging
        console.log(`[Socket.IO] Stream chunk received:`, JSON.stringify(chunk));
        
        const content = chunk?.choices?.[0]?.delta?.content || '';
        totalContent += content;
        chunkCount++;
        
        if (content) {
          console.log(`[Socket.IO] Emitting content: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
          io.to(gameId).emit('llm-stream-chunk', {
            type: 'content',
            content,
            cardId,
            playerId
          });
        }
        
        // Check if the stream is done
        if (chunk?.done) {
          console.log(`[Socket.IO] Received done: true in chunk`);
        }
        
        // Log every 10th chunk to avoid flooding logs
        if (chunkCount % 10 === 0) {
          console.log(`[Socket.IO] Processed ${chunkCount} chunks so far`);
        }
      }
      
      console.log(`[Socket.IO] Stream completed with ${chunkCount} total chunks`);
      console.log(`[Socket.IO] Final content length: ${totalContent.length} characters`);
      
      // If we received no content at all, log a warning
      if (totalContent.length === 0) {
        console.warn(`[Socket.IO] Warning: Stream produced no content`);
      }
    } catch (streamError) {
      console.error(`[Socket.IO] Error streaming chunks:`, streamError);
      console.error(`[Socket.IO] Error details:`, streamError instanceof Error ? {
        message: streamError.message,
        name: streamError.name,
        stack: streamError.stack
      } : streamError);
      
      io.to(gameId).emit('llm-stream-error', {
        message: streamError instanceof Error ? streamError.message : 'Unknown streaming error',
        cardId,
        playerId
      });
    }
    
    // Signal end of stream
    console.log(`[Socket.IO] Emitting stream-end event`);
    io.to(gameId).emit('llm-stream-end', {
      cardId,
      playerId,
      timestamp: Date.now()
    });
    
    // Now process the card play action normally to update the game state
    console.log(`[Socket.IO] Stream completed, processing card play action normally`);
    const result = await gameEngine.processAction(gameId, action);
    
    if (!result.session) {
      console.error(`[Socket.IO] Error processing action: ${result.error}`);
      socket.emit('error', { 
        message: result.error || 'Failed to process action' 
      });
      return;
    }
    
    console.log(`[Socket.IO] Card play processed successfully, broadcasting game state update`);
    
    // Broadcast the final game state update
    io.to(gameId).emit('game-state-update', { 
      gameState: result.session.gameState,
      action: action
    });
    
  } catch (error) {
    console.error(`[Socket.IO] Error in streaming card play:`, error);
    console.error(`[Socket.IO] Error details:`, error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack
    } : error);
    
    socket.emit('error', { 
      message: error instanceof Error ? error.message : 'Unknown error in streaming card play'
    });
    
    // Signal stream error to client
    io.to(gameId).emit('llm-stream-error', {
      message: error instanceof Error ? error.message : 'Unknown error in streaming',
      cardId: action.payload?.cardId,
      playerId: action.payload?.playerId
    });
  }
}

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});