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
  const gameSession = gameEngine.createGameSession(playerId, playerName, isSinglePlayer);
  
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
router.post('/games/:gameId/actions', (req, res) => {
  const { gameId } = req.params;
  const action: GameAction = req.body;
  
  // Process the action using the game engine
  const result = gameEngine.processAction(gameId, action);
  
  if (!result.session) {
    return res.status(result.error?.includes('not found') ? 404 : 400).json({ 
      error: result.error || 'Failed to process action' 
    });
  }
  
  // Return the updated game state
  res.json({
    actionId: action.id,
    status: 'processed',
    timestamp: Date.now(),
    gameState: result.session.gameState
  });
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
router.post('/games/:gameId/start', (req, res) => {
  const { gameId } = req.params;
  
  // Start the game (initialize first turn)
  const startedSession = gameEngine.startGame(gameId);
  
  if (!startedSession) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json({
    gameId,
    message: 'Game started successfully',
    gameState: startedSession.gameState
  });
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