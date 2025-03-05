/**
 * Turn Manager
 * Handles turn phases and transitions
 */

import { GameState, Player, Card, ActionType, GameAction } from '../types';
import { gameReducer } from './game-reducer';
import * as stateHelpers from './state-helpers';
import { v4 as uuidv4 } from 'uuid';

/**
 * Turn Phases
 */
export enum TurnPhase {
  INIT = 'init',
  TURN_START = 'turnStart',
  DRAW = 'draw',
  ACTION = 'action',
  TURN_END = 'turnEnd'
}

/**
 * Start a new turn for the current active player
 */
export const startTurn = (state: GameState): GameState => {
  if (!state.activePlayerId || !state.players[state.activePlayerId]) {
    console.error('No active player to start turn for');
    return state;
  }
  
  // Update the turn start time
  let newState: GameState = {
    ...state,
    phase: TurnPhase.TURN_START,
    turnStartTime: Date.now()
  };
  
  // Reset energy for the active player
  newState = stateHelpers.resetEnergy(newState, state.activePlayerId);
  
  // Process turn start effects (status effects, etc.)
  // For now, we'll just transition to the draw phase
  newState.phase = TurnPhase.DRAW;
  
  return newState;
};

/**
 * Generate cards for a player's turn
 * In a real implementation, this would call the LLM card generator
 */
export const generateCards = (
  state: GameState, 
  playerId: string, 
  count: number,
  isFirstTurn: boolean = false
): GameState => {
  if (!state.players[playerId]) {
    console.error('Player not found for card generation');
    return state;
  }
  
  // In a real implementation, this would call the LLM
  // For now, we'll create dummy cards
  const generatedCards: Card[] = Array(count).fill(0).map((_, index) => {
    const isAttack = index % 3 === 0;
    const isBlock = index % 3 === 1;
    // Rest are special cards
    
    return {
      id: uuidv4(),
      name: isAttack 
        ? `Ethereal Strike ${index}` 
        : isBlock 
          ? `Arcane Barrier ${index}` 
          : `Mystical Enchantment ${index}`,
      cost: 1 + (index % 3),
      base_effects: [
        {
          effect_type: isAttack ? 'damage' : isBlock ? 'block' : 'status',
          value: (isAttack || isBlock) ? 5 + (index % 8) : 2,
          target: isAttack ? 'opponent' : 'self'
        }
      ],
      description: isAttack 
        ? `Deal ${5 + (index % 8)} damage to your opponent.` 
        : isBlock 
          ? `Gain ${5 + (index % 8)} block.` 
          : `Apply a mystical effect.`,
      wildcard_effect: isAttack 
        ? 'The target is marked, taking 2 additional damage from the next attack.' 
        : isBlock 
          ? 'If you have no block at the end of your turn, gain 3 block.' 
          : 'Your next card costs 1 less energy to play.',
      art_prompt: isAttack 
        ? 'A crackling beam of ethereal energy' 
        : isBlock 
          ? 'A shimmering translucent barrier' 
          : 'Swirling magical runes and symbols',
      createdAt: Date.now(),
      createdBy: 'system-generator'
    };
  });
  
  // Add the generated cards to the player's hand
  return stateHelpers.addCardsToHand(state, playerId, generatedCards);
};

/**
 * Process the draw phase for the current active player
 * Generates cards based on the player's draw stat
 */
export const processDraw = (state: GameState): GameState => {
  if (!state.activePlayerId || !state.players[state.activePlayerId]) {
    console.error('No active player for draw phase');
    return state;
  }
  
  const activePlayer = state.players[state.activePlayerId];
  const isFirstTurn = state.turnNumber <= Object.keys(state.players).length;
  
  // Generate cards based on draw stat or first turn rules
  const cardCount = isFirstTurn ? 10 : activePlayer.draw;
  
  // Generate cards for the player
  let newState = generateCards(state, state.activePlayerId, cardCount, isFirstTurn);
  
  // If it's the first turn, stay in the draw phase so the player can select cards
  // Otherwise, move to the action phase
  newState.phase = isFirstTurn ? TurnPhase.DRAW : TurnPhase.ACTION;
  
  return newState;
};

/**
 * End the current player's turn
 */
export const endTurn = (state: GameState): GameState => {
  if (!state.activePlayerId) {
    console.error('No active player to end turn for');
    return state;
  }
  
  // Create an end turn action
  const endTurnAction: GameAction = {
    id: uuidv4(),
    type: ActionType.END_TURN,
    playerId: state.activePlayerId,
    payload: {},
    timestamp: Date.now(),
    gameId: state.id,
    validated: true
  };
  
  // Process the end turn action through the reducer
  return gameReducer(state, endTurnAction);
};

/**
 * Process a full turn sequence automatically
 * Used for AI players or automated turn transitions
 */
export const processFullTurn = (state: GameState): GameState => {
  if (!state.activePlayerId || !state.players[state.activePlayerId]) {
    console.error('No active player for turn processing');
    return state;
  }
  
  // Start turn
  let currentState = startTurn(state);
  
  // Process draw phase
  currentState = processDraw(currentState);
  
  // If it's a first turn, the player would select cards here
  // For now, we'll skip this selection for simplicity
  
  // End turn (this will handle the phase transitions)
  currentState = endTurn(currentState);
  
  return currentState;
};