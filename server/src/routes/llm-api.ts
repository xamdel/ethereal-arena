import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { cardGenerator } from '../llm/card-generator';
import { effectInterpreter } from '../llm/effect-interpreter';
import { llmClient } from '../llm/api-client';
import * as gameEngine from '../game-engine';
import { llmService } from '../game-engine/llm-service';
import { calculateCardEnergyCost } from '../llm';

// @ts-ignore - Suppress Express router type errors for the whole file
// This is a known issue with Express types in TypeScript

const router = express.Router();

/**
 * Generate cards for a game
 * POST /api/llm/games/:gameId/cards
 */
router.post('/games/:gameId/cards', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, count = 5, theme } = req.body;
    
    if (!gameId || !playerId) {
      return res.status(400).json({ error: 'Game ID and player ID are required' });
    }
    
    // Get game session
    const gameSession = gameEngine.getGameSession(gameId);
    
    if (!gameSession) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Convert game state to format needed by LLM service
    const llmGameState = {
      players: gameSession.gameState.players,
      activePlayerId: gameSession.gameState.activePlayerId,
      turn: gameSession.gameState.turnNumber, // Use turnNumber instead of turn
      phase: gameSession.gameState.phase
    };
    
    console.log(`Generating ${count} cards for player ${playerId} in game ${gameId}`);
    
    // Generate cards
    const cards = await llmService.generateCardsForPlayer(
      playerId,
      llmGameState,
      count
    );
    
    console.log(`Generated ${cards.length} cards successfully`);
    
    // Return the generated cards
    res.json({
      gameId,
      playerId,
      cards
    });
  } catch (error) {
    console.error('Error generating cards:', error);
    res.status(500).json({ 
      error: 'Failed to generate cards',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Interpret card effect
 * POST /api/llm/games/:gameId/interpret
 */
router.post('/games/:gameId/interpret', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId, cardId, targetId } = req.body;
    
    if (!gameId || !playerId || !cardId) {
      return res.status(400).json({ error: 'Game ID, player ID and card ID are required' });
    }
    
    // Get game session
    const gameSession = gameEngine.getGameSession(gameId);
    
    if (!gameSession) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Find the card in the player's hand
    const player = gameSession.gameState.players[playerId];
    if (!player) {
      return res.status(404).json({ error: 'Player not found in game' });
    }
    
    const card = player.hand.find(c => c.id === cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found in player hand' });
    }
    
    // Convert game state to format needed by LLM service
    const llmGameState = {
      players: gameSession.gameState.players,
      activePlayerId: gameSession.gameState.activePlayerId,
      turn: gameSession.gameState.turnNumber, // Use turnNumber instead of turn
      phase: gameSession.gameState.phase
    };
    
    // Interpret card effects
    const interpretation = await llmService.interpretCardEffects(
      card,
      playerId,
      llmGameState,
      targetId
    );
    
    // Return the interpretation
    res.json({
      gameId,
      playerId,
      cardId,
      interpretation
    });
  } catch (error) {
    console.error('Error interpreting card effect:', error);
    res.status(500).json({ 
      error: 'Failed to interpret card effect',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate game narrative
 * POST /api/llm/games/:gameId/narrative
 */
router.post('/games/:gameId/narrative', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { previousAction } = req.body;
    
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID is required' });
    }
    
    // Get game session
    const gameSession = gameEngine.getGameSession(gameId);
    
    if (!gameSession) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Convert game state to format needed by LLM service
    const llmGameState = {
      players: gameSession.gameState.players,
      activePlayerId: gameSession.gameState.activePlayerId,
      turn: gameSession.gameState.turnNumber, // Use turnNumber instead of turn
      phase: gameSession.gameState.phase
    };
    
    // Generate narrative
    const narrative = await llmService.generateNarrative(
      llmGameState,
      previousAction
    );
    
    // Return the narrative
    res.json({
      gameId,
      narrative
    });
  } catch (error) {
    console.error('Error generating narrative:', error);
    res.status(500).json({ 
      error: 'Failed to generate narrative',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear card energy cost cache for a player
 * POST /api/llm/games/:gameId/players/:playerId/clear-cost-cache
 */
router.post('/games/:gameId/players/:playerId/clear-cost-cache', async (req, res) => {
  try {
    const { gameId, playerId } = req.params;
    
    if (!gameId || !playerId) {
      return res.status(400).json({ error: 'Game ID and player ID are required' });
    }
    
    // Get game session
    const gameSession = gameEngine.getGameSession(gameId);
    
    if (!gameSession) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Clear the cost cache for the player
    await llmService.clearCardEnergyCostCache(playerId);
    
    // Return success
    res.json({
      gameId,
      playerId,
      message: 'Card energy cost cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing card energy cost cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear card energy cost cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Calculate card energy cost
 * POST /api/llm/games/:gameId/cards/:cardId/cost
 */
router.post('/games/:gameId/cards/:cardId/cost', async (req, res) => {
  try {
    const { gameId, cardId } = req.params;
    const { playerId } = req.body;
    
    if (!gameId || !playerId || !cardId) {
      return res.status(400).json({ error: 'Game ID, player ID and card ID are required' });
    }
    
    // Get game session
    const gameSession = gameEngine.getGameSession(gameId);
    
    if (!gameSession) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Find the card in the player's hand
    const player = gameSession.gameState.players[playerId];
    if (!player) {
      return res.status(404).json({ error: 'Player not found in game' });
    }
    
    const card = player.hand.find(c => c.id === cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found in player hand' });
    }
    
    // Convert game state to format needed by LLM service
    const llmGameState = {
      players: gameSession.gameState.players,
      activePlayerId: gameSession.gameState.activePlayerId,
      turn: gameSession.gameState.turnNumber,
      phase: gameSession.gameState.phase
    };
    
    // Calculate card energy cost
    const costResult = await calculateCardEnergyCost(
      card,
      playerId,
      llmGameState
    );
    
    // Return the cost calculation
    res.json({
      gameId,
      playerId,
      cardId,
      canPlay: costResult.canPlay,
      energyCost: costResult.energyCost,
      reason: costResult.reason
    });
  } catch (error) {
    console.error('Error calculating card energy cost:', error);
    res.status(500).json({ 
      error: 'Failed to calculate card energy cost',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test LLM connection
 * GET /api/llm/test
 */
router.get('/test', async (req, res) => {
  try {
    // Run a simple test completion to verify the LLM connection
    const response = await llmClient.complete('Hello, can you confirm that you are working properly?', {
      maxTokens: 50,
      temperature: 0.3,
    });
    
    res.json({
      status: 'success',
      message: 'LLM connection is working',
      response: {
        content: response.content,
        model: response.model,
        tokens: {
          prompt: response.promptTokens,
          completion: response.completionTokens,
          total: response.totalTokens
        }
      }
    });
  } catch (error) {
    console.error('LLM connection test failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'LLM connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;