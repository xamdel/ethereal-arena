import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { GameSession, GameState, GameAction, ActionType } from '../types';

// In-memory game sessions store (would be replaced with a database in production)
const gameSessions: Record<string, GameSession> = {};

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
  
  // Create a new empty game state
  const gameId = uuidv4();
  const initialGameState: GameState = {
    id: gameId,
    players: {},
    activePlayerId: '',
    turnNumber: 0,
    phase: 'init',
    effectQueue: [],
    actionHistory: [],
    turnStartTime: Date.now(),
    lastUpdateTime: Date.now(),
    winner: null,
    isMultiplayer: !isSinglePlayer
  };
  
  // Create the game session
  const gameSession: GameSession = {
    id: gameId,
    gameState: initialGameState,
    players: [playerId],
    createdAt: Date.now(),
    lastActive: Date.now(),
    isActive: true
  };
  
  gameSessions[gameId] = gameSession;
  
  res.status(201).json({ 
    gameId, 
    message: 'Game created successfully',
    gameState: initialGameState
  });
});

/**
 * Get game state
 * GET /api/games/:gameId
 */
router.get('/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  
  if (!gameSessions[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const gameSession = gameSessions[gameId];
  
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
  
  if (!gameSessions[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const gameSession = gameSessions[gameId];
  
  // Validate the action (basic validation for now)
  if (!action.id || !action.type || !action.playerId) {
    return res.status(400).json({ error: 'Invalid action format' });
  }
  
  // In a complete implementation, this would process the action through the game engine
  // For now, we'll just add it to the action history
  gameSession.gameState.actionHistory.push(action);
  gameSession.lastActive = Date.now();
  
  // Basic acknowledgment response
  res.json({
    actionId: action.id,
    status: 'received',
    timestamp: Date.now()
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
  
  if (!gameSessions[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const gameSession = gameSessions[gameId];
  
  // Check if the game already has the maximum number of players
  if (gameSession.players.length >= 2) {
    return res.status(400).json({ error: 'Game is full' });
  }
  
  // Add the player to the game
  if (!gameSession.players.includes(playerId)) {
    gameSession.players.push(playerId);
  }
  
  gameSession.lastActive = Date.now();
  
  res.json({
    gameId,
    message: 'Joined game successfully',
    gameState: gameSession.gameState
  });
});

export default router;