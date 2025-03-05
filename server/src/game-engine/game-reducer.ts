/**
 * Game state reducer
 * Handles all game state transitions through actions
 */

import { v4 as uuidv4 } from 'uuid';
import { GameState, GameAction, ActionType, Card } from '../types';
import * as stateHelpers from './state-helpers';

/**
 * Process a game action and return the updated state
 */
export const gameReducer = (state: GameState, action: GameAction): GameState => {
  // Validate the action first
  if (!action.id || !action.type || !action.playerId) {
    console.error('Invalid action:', action);
    return state;
  }
  
  // Update the last update time
  let newState: GameState = {
    ...state,
    lastUpdateTime: Date.now()
  };
  
  // Add the action to history
  newState.actionHistory = [...newState.actionHistory, action];
  
  // Process the action based on its type
  switch (action.type) {
    case ActionType.GAME_INIT:
      return handleGameInit(newState, action);
      
    case ActionType.PLAY_CARD:
      return handlePlayCard(newState, action);
      
    case ActionType.END_TURN:
      return handleEndTurn(newState, action);
      
    case ActionType.SELECT_CARDS:
      return handleSelectCards(newState, action);
      
    case ActionType.APPLY_EFFECT:
      return handleApplyEffect(newState, action);
      
    case ActionType.PROCESS_QUEUE:
      return handleProcessQueue(newState, action);
      
    default:
      console.warn(`Unknown action type: ${action.type}`);
      return newState;
  }
};

/**
 * Handle game initialization action
 */
const handleGameInit = (state: GameState, action: GameAction): GameState => {
  // Extract initialization data from the payload
  const { 
    gameId, 
    players = [], 
    isMultiplayer = false 
  } = action.payload || {};
  
  // Create a new game state
  let newState = stateHelpers.createInitialGameState(
    gameId || state.id || uuidv4(),
    isMultiplayer
  );
  
  // Add players if provided
  if (players && Array.isArray(players)) {
    players.forEach(player => {
      newState = stateHelpers.addPlayer(
        newState,
        player.id,
        player.name,
        player.isAI || false
      );
    });
  }
  
  return {
    ...newState,
    phase: 'init'
  };
};

/**
 * Handle play card action
 */
const handlePlayCard = (state: GameState, action: GameAction): GameState => {
  const { cardId, targetPlayerId } = action.payload || {};
  
  if (!cardId) {
    console.error('Missing card ID in play card action');
    return state;
  }
  
  // Verify it's the player's turn
  if (state.activePlayerId !== action.playerId) {
    console.error('Not player\'s turn');
    return state;
  }
  
  // Play the card
  const { state: newState, playedCard } = stateHelpers.playCard(state, action.playerId, cardId);
  
  if (!playedCard) {
    console.error('Failed to play card');
    return state;
  }
  
  // In a real implementation, this would send the card and game state to the LLM for interpretation
  // For now, we'll just handle the base effects
  
  let stateWithEffects = newState;
  
  if (playedCard.base_effects && Array.isArray(playedCard.base_effects)) {
    // Process base effects
    playedCard.base_effects.forEach(effect => {
      const effectTarget = effect.target === 'self' ? action.playerId : targetPlayerId;
      
      if (!effectTarget) {
        console.warn('No target for effect, skipping');
        return;
      }
      
      // Add the effect to the queue
      stateWithEffects = stateHelpers.addEffectToQueue(stateWithEffects, {
        type: effect.effect_type,
        value: effect.value,
        source: action.playerId,
        target: effectTarget,
        card: cardId,
        timing: 'immediate',
        actionId: action.id
      });
    });
  }
  
  // Process immediate effects
  stateWithEffects = stateHelpers.processAllEffects(stateWithEffects);
  
  return {
    ...stateWithEffects,
    phase: 'action'
  };
};

/**
 * Handle end turn action
 */
const handleEndTurn = (state: GameState, action: GameAction): GameState => {
  // Verify it's the player's turn
  if (state.activePlayerId !== action.playerId) {
    console.error('Not player\'s turn');
    return state;
  }
  
  // Process end-of-turn effects
  let newState = { ...state, phase: 'turnEnd' };
  
  // Clear cards for the current player
  newState = stateHelpers.clearCardsAtEndOfTurn(newState, action.playerId);
  
  // Reset block for all players
  newState = stateHelpers.resetBlockAtEndOfTurn(newState);
  
  // Update status effects
  newState = stateHelpers.updateStatusEffects(newState);
  
  // Switch to the next player
  newState = stateHelpers.switchActivePlayer(newState);
  
  // Reset energy for the new active player
  if (newState.activePlayerId) {
    newState = stateHelpers.resetEnergy(newState, newState.activePlayerId);
  }
  
  // Update phase to turnStart for the next player
  return {
    ...newState,
    phase: 'turnStart'
  };
};

/**
 * Handle selecting cards from a generated pool
 * Used at the start of the game or when selecting from generated options
 */
const handleSelectCards = (state: GameState, action: GameAction): GameState => {
  const { selectedCardIds } = action.payload || {};
  
  if (!selectedCardIds || !Array.isArray(selectedCardIds)) {
    console.error('Missing or invalid selected card IDs');
    return state;
  }
  
  // Update the player's hand to only include selected cards
  const newState = stateHelpers.selectInitialCards(state, action.playerId, selectedCardIds);
  
  // If this is during initialization, move to the action phase
  if (state.phase === 'init') {
    return {
      ...newState,
      phase: 'action'
    };
  }
  
  return newState;
};

/**
 * Handle applying an effect
 */
const handleApplyEffect = (state: GameState, action: GameAction): GameState => {
  const { effect } = action.payload || {};
  
  if (!effect) {
    console.error('Missing effect in apply effect action');
    return state;
  }
  
  // Add the effect to the queue
  let newState = stateHelpers.addEffectToQueue(state, {
    ...effect,
    actionId: action.id
  });
  
  // Process the effect queue if it's an immediate effect
  if (effect.timing === 'immediate') {
    newState = stateHelpers.processAllEffects(newState);
  }
  
  return newState;
};

/**
 * Handle processing the effect queue
 */
const handleProcessQueue = (state: GameState, action: GameAction): GameState => {
  return stateHelpers.processAllEffects(state);
};