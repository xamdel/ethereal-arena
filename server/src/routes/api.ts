import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { GameSession, GameState, GameAction, ActionType } from '../types';
import * as gameEngine from '../game-engine';

const router = express.Router();

/**
 * Create a new game session
 * POST /api/games
 */
router.post('/games', (req, res) => {
  const { playerId, playerName, isSinglePlayer = true } = req.body;
  
  if (!playerId || !playerName) {
    return res.status(400).json({ error: 'Player ID and name are required' });
  }
  
  // Create a new game session using the game engine
  console.log(`Creating new game session for player ${playerId} (${playerName}), singlePlayer: ${isSinglePlayer}`);
  const gameSession = gameEngine.createGameSession(playerId, playerName, isSinglePlayer);
  
  // Log the created game state
  console.log(`Game session created with ID: ${gameSession.id}`);
  console.log(`Game state players: ${Object.keys(gameSession.gameState.players).length}`);
  console.log(`Game state active player: ${gameSession.gameState.activePlayerId}`);
  
  // Return the created game session
  res.status(201).json({ 
    gameId: gameSession.id, 
    message: 'Game created successfully',
    gameState: gameSession.gameState
  });
});

/**
 * Get game state
 * GET /api/games/:gameId
 */
router.get('/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  
  const gameSession = gameEngine.getGameSession(gameId);
  
  if (!gameSession) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json({
    gameState: gameSession.gameState
  });
});

/**
 * Submit player action
 * POST /api/games/:gameId/actions
 */
router.post('/games/:gameId/actions', async (req, res) => {
  const { gameId } = req.params;
  const action: GameAction = req.body;
  
  console.log(`Received action ${action.type} for game ${gameId} from player ${action.playerId}`);
  
  try {
    // Process the action using the game engine - now async
    const result = await gameEngine.processAction(gameId, action);
    
    if (!result.session) {
      console.error(`Failed to process action: ${result.error}`);
      return res.status(result.error?.includes('not found') ? 404 : 400).json({ 
        error: result.error || 'Failed to process action' 
      });
    }
    
    console.log(`Action processed successfully`);
    
    // Return the updated game state
    res.json({
      actionId: action.id,
      status: 'processed',
      timestamp: Date.now(),
      gameState: result.session.gameState
    });
  } catch (error) {
    console.error(`Error processing action:`, error);
    res.status(500).json({
      error: 'Internal server error processing action',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Join an existing game
 * POST /api/games/:gameId/join
 */
router.post('/games/:gameId/join', (req, res) => {
  const { gameId } = req.params;
  const { playerId, playerName } = req.body;
  
  if (!playerId || !playerName) {
    return res.status(400).json({ error: 'Player ID and name are required' });
  }
  
  // Add the player to the game session
  const updatedSession = gameEngine.addPlayerToSession(gameId, playerId, playerName);
  
  if (!updatedSession) {
    return res.status(404).json({ error: 'Game not found or cannot join' });
  }
  
  res.json({
    gameId,
    message: 'Joined game successfully',
    gameState: updatedSession.gameState
  });
});

/**
 * Start a game
 * POST /api/games/:gameId/start
 */
router.post('/games/:gameId/start', async (req, res) => {
  const { gameId } = req.params;
  
  console.log(`Received request to start game: ${gameId}`);
  
  try {
    // Start the game (initialize first turn) - this is now async to use LLM
    const startedSession = await gameEngine.startGame(gameId);
    
    if (!startedSession) {
      console.error(`Failed to start game: ${gameId}`);
      return res.status(404).json({ error: 'Game not found' });
    }
    
    console.log(`Game ${gameId} started successfully`);
    console.log(`Active player: ${startedSession.gameState.activePlayerId}`);
    console.log(`Player hand sizes:`);
    Object.keys(startedSession.gameState.players).forEach(playerId => {
      const handSize = startedSession.gameState.players[playerId].hand?.length || 0;
      console.log(`- Player ${playerId}: ${handSize} cards`);
    });
    
    res.json({
      gameId,
      message: 'Game started successfully',
      gameState: startedSession.gameState
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ 
      error: 'Failed to start game',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all active games for a player
 * GET /api/players/:playerId/games
 */
router.get('/players/:playerId/games', (req, res) => {
  const { playerId } = req.params;
  
  const playerSessions = gameEngine.getPlayerSessions(playerId);
  
  res.json({
    games: playerSessions.map(session => ({
      id: session.id,
      createdAt: session.createdAt,
      lastActive: session.lastActive,
      players: session.players,
      isActive: session.isActive
    }))
  });
});

export default router;