/**
 * Game Session Manager
 * Manages game sessions and transitions
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GameSession,
  GameState,
  GameAction,
  ActionType,
  Player
} from '../types';
import { gameReducer } from './game-reducer';
import * as turnManager from './turn-manager';
import * as stateHelpers from './state-helpers';

// In-memory storage for game sessions
// In a production environment, this would be a database
const gameSessions: Record<string, GameSession> = {};

// Action queue for each game
const actionQueues: Record<string, GameAction[]> = {};

/**
 * Create a new game session
 */
export const createGameSession = (
  playerId: string,
  playerName: string,
  isSinglePlayer: boolean = true
): GameSession => {
  const gameId = uuidv4();

  // Create the initial game state
  const initialGameState = stateHelpers.createInitialGameState(gameId, !isSinglePlayer);

  // Create the game session
  const gameSession: GameSession = {
    id: gameId,
    gameState: initialGameState,
    players: [playerId],
    createdAt: Date.now(),
    lastActive: Date.now(),
    isActive: true
  };

  // Add the first player
  gameSession.gameState = stateHelpers.addPlayer(gameSession.gameState, playerId, playerName, false);

  // If it's a single player game, add an AI opponent
  if (isSinglePlayer) {
    gameSession.gameState = stateHelpers.addPlayer(
      gameSession.gameState,
      'ai-player',
      'AI Opponent',
      true
    );

    // Add the AI player ID to the session players
    gameSession.players.push('ai-player');
  }

  // Store the session
  gameSessions[gameId] = gameSession;

  return gameSession;
};

/**
 * Get a game session by ID
 */
export const getGameSession = (gameId: string): GameSession | null => {
  return gameSessions[gameId] || null;
};

/**
 * Add a player to a game session
 */
export const addPlayerToSession = (
  gameId: string,
  playerId: string,
  playerName: string
): GameSession | null => {
  const session = getGameSession(gameId);

  if (!session) {
    return null;
  }

  // Check if the game already has the maximum number of players
  if (session.players.length >= 2) {
    console.error('Game is full');
    return null;
  }

  // Check if the player is already in the game
  if (session.players.includes(playerId)) {
    return session;
  }

  // Add the player to the game state
  session.gameState = stateHelpers.addPlayer(session.gameState, playerId, playerName, false);

  // Add the player to the session
  session.players.push(playerId);
  session.lastActive = Date.now();

  // Update the session in storage
  gameSessions[gameId] = session;

  return session;
};

/**
 * Process a game action
 */
export const processAction = async (
  gameId: string,
  action: GameAction
): Promise<{ session: GameSession | null; error?: string }> => {
  const session = getGameSession(gameId);

  if (!session) {
    return { session: null, error: 'Game session not found' };
  }

  // Validate the action
  if (!action.id || !action.type || !action.playerId) {
    return { session: null, error: 'Invalid action format' };
  }

  // Check if the player is in the game
  if (!session.players.includes(action.playerId)) {
    return { session: null, error: 'Player not in game session' };
  }


  // Extract sequence number from action ID
  const sequenceNumber = parseInt(action.id.split('-').pop() || '0', 10);

    // Add the action to the queue
    actionQueues[gameId] = actionQueues[gameId] || [];
    actionQueues[gameId].push({ ...action, sequenceNumber });


  try {
    console.log(`[GameSessionManager] Processing action ${action.type} for game ${gameId}`);

    // Process the action - now async!
    const newGameState = await gameReducer(session.gameState, action);

    // Update the session
    session.gameState = newGameState;
    session.lastActive = Date.now();

    // Handle AI turn if it's a single player game and it's the AI's turn
    if (
      session.gameState.activePlayerId === 'ai-player' &&
      session.players.includes('ai-player')
    ) {
      console.log(`[GameSessionManager] Processing AI turn for game ${gameId}`);
      // Process the AI turn - now async
      session.gameState = await processAITurn(session.gameState);
    }

    // Update the session in storage
    gameSessions[gameId] = session;

    console.log(`[GameSessionManager] Action processed successfully`);
    return { session };
  } catch (error) {
    console.error(`[GameSessionManager] Error processing action:`, error);
    return { session: null, error: `Error processing action: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};

/**
 * Process an AI turn
 * This is a simple implementation that just plays random cards
 * Now supports async operations for LLM integration
 */
export const processAITurn = async (state: GameState): Promise<GameState> => {
  if (state.activePlayerId !== 'ai-player') {
    return state;
  }

  console.log(`[AI Turn] Starting AI turn`);

  // Start the AI turn
  let currentState = turnManager.startTurn(state);

  try {
    // Process the draw phase - this might be async now
    console.log(`[AI Turn] Processing draw phase`);
    currentState = await turnManager.processDraw(currentState);

    // AI logic: play cards randomly until out of energy
    const aiPlayer = currentState.players['ai-player'];

    if (aiPlayer && aiPlayer.hand.length > 0) {
      console.log(`[AI Turn] AI has ${aiPlayer.hand.length} cards and ${aiPlayer.energy} energy`);

      // Get opponent ID
      const opponentId = Object.keys(currentState.players).find(id => id !== 'ai-player');

      if (!opponentId) {
        console.error('[AI Turn] No opponent found for AI');
        return turnManager.endTurn(currentState);
      }

      // Play cards while we have energy and cards
      let aiActionState = { ...currentState };

      // Limit the number of cards the AI plays per turn for performance
      const maxCardsToPlay = 3;
      let cardsPlayed = 0;

      while (aiPlayer.energy > 0 && aiPlayer.hand.length > 0 && cardsPlayed < maxCardsToPlay) {
        // Find playable cards (that we have energy for)
        const playableCards = aiPlayer.hand.filter(card => card.cost <= aiPlayer.energy);

        if (playableCards.length === 0) {
          console.log(`[AI Turn] No more playable cards`);
          break;
        }

        // Choose a random card to play
        const cardToPlay = playableCards[Math.floor(Math.random() * playableCards.length)];
        console.log(`[AI Turn] Playing card: ${cardToPlay.name} (${cardToPlay.cost} energy)`);

        // Create play card action
        const playCardAction: GameAction = {
          id: uuidv4(),
          type: ActionType.PLAY_CARD,
          playerId: 'ai-player',
          payload: {
            cardId: cardToPlay.id,
            targetPlayerId: opponentId
          },
          timestamp: Date.now(),
          gameId: state.id,
          validated: true
        };

        try {
          // Process the action - now async!
          console.log(`[AI Turn] Processing play card action`);
          aiActionState = await gameReducer(aiActionState, playCardAction);
          cardsPlayed++;

          // Update the AI player reference for next iteration
          const updatedAiPlayer = aiActionState.players['ai-player'];

          // Break if the game ended or something went wrong
          if (!updatedAiPlayer || aiActionState.winner) {
            console.log(`[AI Turn] Game ended or AI player not found`);
            break;
          }

          console.log(`[AI Turn] AI now has ${updatedAiPlayer.hand.length} cards and ${updatedAiPlayer.energy} energy`);
        } catch (error) {
          console.error(`[AI Turn] Error playing card:`, error);
          break;
        }
      }

      console.log(`[AI Turn] AI played ${cardsPlayed} cards, ending turn`);

      // End the AI turn
      return turnManager.endTurn(aiActionState);
    }

    console.log(`[AI Turn] AI has no cards or energy, ending turn`);

    // If no cards or energy, just end the turn
    return turnManager.endTurn(currentState);
  } catch (error) {
    console.error(`[AI Turn] Error in AI turn:`, error);
    return turnManager.endTurn(currentState);
  }
};

/**
 * Start a game (initialize first turn)
 */
export const startGame = async (gameId: string): Promise<GameSession | null> => {
  console.log(`Starting game with ID: ${gameId}`);
  const session = getGameSession(gameId);

  if (!session) {
    console.error(`Game session not found with ID: ${gameId}`);
    return null;
  }

  // Check if we have at least one player
  if (session.players.length === 0) {
    console.error('Cannot start game with no players');
    return null;
  }

  console.log(`Game has ${session.players.length} players: ${session.players.join(', ')}`);
  console.log(`Active player: ${session.gameState.activePlayerId}`);

  // Start the first turn for the active player
  session.gameState = turnManager.startTurn(session.gameState);

  // Process the draw phase to generate initial cards using LLM
  console.log(`Calling processDraw for player ${session.gameState.activePlayerId}`);
  try {
    session.gameState = await turnManager.processDraw(session.gameState);

    // Log player hand sizes after draw
    Object.keys(session.gameState.players).forEach(playerId => {
      const handSize = session.gameState.players[playerId].hand?.length || 0;
      console.log(`Player ${playerId} hand size: ${handSize}`);

      // Log first few cards for debugging
      if (handSize > 0) {
        const cards = session.gameState.players[playerId].hand.slice(0, 3);
        console.log(`Sample cards for player ${playerId}:`);
        cards.forEach((card, i) => {
          console.log(`  Card ${i+1}: ${card.name} (${card.cost} energy) - ${card.description}`);
        });
      }
    });

    // Update the session
    session.lastActive = Date.now();
    gameSessions[gameId] = session;

    console.log(`Game started successfully, active player: ${session.gameState.activePlayerId}`);
    return session;
  } catch (error) {
    console.error('Error starting game:', error);
    return null;
  }
};

/**
 * Clean up inactive game sessions
 * This would be run on a schedule in a production environment
 */
export const cleanupInactiveSessions = (maxAgeMs: number = 24 * 60 * 60 * 1000): void => {
  const now = Date.now();

  Object.keys(gameSessions).forEach(gameId => {
    const session = gameSessions[gameId];

    if (now - session.lastActive > maxAgeMs) {
      console.log(`Cleaning up inactive game session: ${gameId}`);
      delete gameSessions[gameId];
    }
  });
};

/**
 * Get all game sessions (for admin purposes)
 */
export const getAllGameSessions = (): GameSession[] => {
  return Object.values(gameSessions);
};

/**
 * Get sessions for a specific player
 */
export const getPlayerSessions = (playerId: string): GameSession[] => {
  return Object.values(gameSessions).filter(session => 
    session.players.includes(playerId) && session.isActive
  );
};