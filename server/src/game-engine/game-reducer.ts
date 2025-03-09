/**
 * Game state reducer
 * Handles all game state transitions through actions
 */

import { v4 as uuidv4 } from 'uuid';
import { GameState, GameAction, ActionType, Card } from '../types';
import * as stateHelpers from './state-helpers';

// Type-safe phase values
type GamePhase = GameState['phase'];
const PHASES: { [key: string]: GamePhase } = {
  INIT: 'init',
  TURN_START: 'turnStart',
  DRAW: 'draw',
  ACTION: 'action',
  TURN_END: 'turnEnd'
};

/**
 * Process a game action and return the updated state
 * Now supports async operations for LLM integration
 */
export const gameReducer = async (state: GameState, action: GameAction): Promise<GameState> => {
  // Validate the action first
  if (!action.id || !action.type || !action.playerId) {
    console.error('Invalid action:', action);
    return state;
  }
  
  console.log(`[Game Reducer] Processing action: ${action.type} from player ${action.playerId}`);
  
  // Update the last update time
  let newState: GameState = {
    ...state,
    lastUpdateTime: Date.now()
  };
  
  // Add the action to history
  newState.actionHistory = [...newState.actionHistory, action];
  
  // NOTE: We don't clear the energy cost cache here anymore
  // It's now handled in the handlePlayCard method after retrieving the cost
  // but before calling the effect interpreter
  
  // Process the action based on its type
  try {
    switch (action.type) {
      case ActionType.GAME_INIT:
        return handleGameInit(newState, action);
        
      case ActionType.PLAY_CARD:
        return await handlePlayCard(newState, action);
        
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
  } catch (error) {
    console.error(`[Game Reducer] Error processing action ${action.type}:`, error);
    return newState; // Return current state if there's an error
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
    phase: PHASES.INIT
  };
};

/**
 * Handle play card action
 */
const handlePlayCard = async (state: GameState, action: GameAction): Promise<GameState> => {
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
  
  console.log(`[Game Reducer] Playing card: ${playedCard.name} (${playedCard.id})`, playedCard);
  console.log(`[Game Reducer] Base effects: ${playedCard.base_effects}`);
  console.log(`[Game Reducer] Wildcard effect: ${playedCard.wildcard_effect ? playedCard.wildcard_effect : 'None'}`);

  try {
    // Convert game state to format for LLM
    const llmGameState = {
      players: Object.entries(newState.players).reduce((acc, [id, player]) => {
        acc[id] = {
          id,
          hp: player.hp,
          maxHp: player.maxHp,
          block: player.block,
          energy: player.energy,
          statusEffects: player.statusEffects || []
        };
        return acc;
      }, {} as any),
      activePlayerId: newState.activePlayerId,
      turn: newState.turnNumber,
      phase: newState.phase
    };
    
    // 1. First, calculate energy cost (should use cached value if available)
    const { calculateCardEnergyCost } = await import('../llm');
    const costResult = await calculateCardEnergyCost(playedCard, action.playerId, llmGameState);
    
    // Verify player can afford this card
    if (!costResult.canPlay) {
      console.log(`[Game Reducer] Player can't afford to play card ${playedCard.name} - requires ${costResult.energyCost} energy`);
      return state; // Return original state without changes
    }
    
    // 2. Apply the energy cost immediately
    let stateWithEnergyCost = newState;
    const energyCostEffect = {
      id: crypto.randomUUID(),
      type: 'energy',
      value: -costResult.energyCost, // Negative for cost
      source: action.playerId,
      target: action.playerId,
      card: cardId,
      timing: "immediate",
      actionId: action.id
    };
    
    console.log(`[Game Reducer] Applying energy cost: ${costResult.energyCost} for player ${action.playerId}`);
    stateWithEnergyCost = stateHelpers.addEffectToQueue(stateWithEnergyCost, energyCostEffect);
    stateWithEnergyCost = stateHelpers.processAllEffects(stateWithEnergyCost);
    
    // Set on_play_description as the initial narrative while we wait for effect interpretations
    if (playedCard.on_play_description) {
      // Process placeholders in the description
      let processedDescription = playedCard.on_play_description;
      
      // Replace [player] with the player's name
      const playerName = state.players[action.playerId]?.name || "Player";
      processedDescription = processedDescription.replace(/\[player\]/g, playerName);
      
      // Replace [opponent] with the opponent's name
      const opponentId = Object.keys(state.players).find(id => id !== action.playerId);
      const opponentName = opponentId ? state.players[opponentId]?.name || "Opponent" : "Opponent";
      processedDescription = processedDescription.replace(/\[opponent\]/g, opponentName);
      
      stateWithEnergyCost = {
        ...stateWithEnergyCost,
        lastNarrative: processedDescription,  // For backward compatibility
        cardNarrative: processedDescription    // Card narrative field
      };
    }
    
    // 3. After applying the cost, clear the cache
    const { llmService } = await import('./llm-service');
    await llmService.clearCardEnergyCostCache(action.playerId);
    
    // 4. Check if this is a streaming request
    const useStreaming = !!action.payload?.streamResponse;
    
    console.log(`[Game Reducer] Use streaming mode: ${useStreaming}`);
    console.log(`[Game Reducer] Calling LLM service for card effect interpretation...`);
    
    // If streaming mode is handled by the socket server, we still need to
    // interpret the card effects here to update the game state
    const interpretation = await llmService.interpretCardEffects(
      playedCard,
      action.playerId,
      llmGameState,
      targetPlayerId
    );
    
    // Check if the card can be played according to the LLM
    if (!interpretation.canPlayCard) {
      console.log(`[Game Reducer] LLM determined that card ${playedCard.name} cannot be played with current status effects`);
      return state; // Return original state without changes
    }
    
    console.log(`[Game Reducer] Received interpretation with ${interpretation.stateChanges.length} state changes`, interpretation.stateChanges);
    
    // Process the interpreted effects
    let stateWithEffects = stateWithEnergyCost;
    
    // Convert StateChangeActions to QueuedEffects and add to the queue
    interpretation.stateChanges.forEach(stateChange => {
      // Skip any REMOVE_ENERGY actions since we already handled energy cost
      if (stateChange.action === 'REMOVE_ENERGY') {
        console.log(`[Game Reducer] Skipping REMOVE_ENERGY from effect interpreter as cost was already applied`);
        return;
      }
      
      // Map the new state change format to game engine effects
      const queuedEffect = mapStateChangeToQueuedEffect(stateChange, action.playerId, stateWithEnergyCost, cardId, action.id);
      
      if (queuedEffect) {
        console.log(`[Game Reducer] Adding effect to queue: ${queuedEffect.type} targeting ${queuedEffect.target}`);
        stateWithEffects = stateHelpers.addEffectToQueue(stateWithEffects, queuedEffect);
      }
    });
    
    // Add narratives to game state for UI
    // Collect effect narrations
    const effectNarrations = interpretation.stateChanges
      .filter(change => change.narration)
      .map(change => change.narration);
    
    stateWithEffects = {
      ...stateWithEffects,
      cardNarrative: interpretation.narrative,      // Overall card narrative
      effectNarrations: effectNarrations,           // Individual effect narrations
      lastNarrative: interpretation.narrative       // For backward compatibility
    };
    
    // Process immediate effects
    stateWithEffects = stateHelpers.processAllEffects(stateWithEffects);
    
    // Debug the final state before returning
    const finalState = {
      ...stateWithEffects,
      phase: PHASES.ACTION
    };
    
    // Log player stats to verify effects were applied
    Object.keys(finalState.players).forEach(playerId => {
      const player = finalState.players[playerId];
      console.log(`[Game Reducer] Final state for player ${playerId}:`, {
        hp: player.hp,
        maxHp: player.maxHp,
        block: player.block,
        energy: player.energy,
        statusEffects: player.statusEffects,
      });
    });
    
    return finalState;
  } catch (error) {
    console.error(`[Game Reducer] Error interpreting card effects:`, error);
    console.log(`[Game Reducer] Falling back to basic effect processing`);
    
    // Fallback: Just process the base effects directly
    let stateWithEffects = newState;
    
    // Apply energy cost in fallback mode
    try {
      const { calculateCardEnergyCost } = await import('../llm');
      const llmGameState = {
        players: Object.entries(newState.players).reduce((acc, [id, player]) => {
          acc[id] = {
            id,
            hp: player.hp,
            maxHp: player.maxHp,
            block: player.block,
            energy: player.energy,
            statusEffects: player.statusEffects || []
          };
          return acc;
        }, {} as any),
        activePlayerId: newState.activePlayerId,
        turn: newState.turnNumber,
        phase: newState.phase
      };
      
      const costResult = await calculateCardEnergyCost(playedCard, action.playerId, llmGameState);
      
      // Apply the energy cost
      stateWithEffects = stateHelpers.addEffectToQueue(stateWithEffects, {
        id: crypto.randomUUID(),
        type: 'energy',
        value: -costResult.energyCost, // Negative for cost
        source: action.playerId,
        target: action.playerId,
        card: cardId,
        timing: 'immediate',
        actionId: action.id
      });
      
      stateWithEffects = stateHelpers.processAllEffects(stateWithEffects);
    } catch (costError) {
      console.error(`[Game Reducer] Error applying energy cost in fallback mode:`, costError);
      // If calculating cost fails, apply base cost
      stateWithEffects = stateHelpers.addEffectToQueue(stateWithEffects, {
        id: crypto.randomUUID(),
        type: 'energy',
        value: -playedCard.cost, // Negative for cost
        source: action.playerId,
        target: action.playerId,
        card: cardId,
        timing: 'immediate',
        actionId: action.id
      });
      
      stateWithEffects = stateHelpers.processAllEffects(stateWithEffects);
    }
    // Process base effects (fallback - string format)
    if (playedCard.base_effects) {
      // Add the effect to the queue
      stateWithEffects = stateHelpers.addEffectToQueue(stateWithEffects, {
        id: crypto.randomUUID(),
        type: 'effect', // Generic effect type
        value: 0, // No specific value
        source: action.playerId,
        target: action.playerId, // Default target
        card: cardId,
        timing: 'immediate',
        actionId: action.id
      });
    }

    // Process immediate effects
    stateWithEffects = stateHelpers.processAllEffects(stateWithEffects);
    
    // Debug the final state before returning
    const finalState = {
      ...stateWithEffects,
      phase: PHASES.ACTION
    };
    
    // Log player stats to verify effects were applied
    Object.keys(finalState.players).forEach(playerId => {
      const player = finalState.players[playerId];
      console.log(`[Game Reducer] Fallback: Final state for player ${playerId}:`, {
        hp: player.hp,
        maxHp: player.maxHp,
        block: player.block,
        energy: player.energy,
        statusEffects: player.statusEffects,
      });
    });
    
    return finalState;
  }
};

/**
 * Map the new StateChangeAction format to the QueuedEffect format
 * expected by the game engine
 */
const mapStateChangeToQueuedEffect = (
  stateChange: any, 
  playerId: string, 
  gameState: GameState, 
  cardId: string, 
  actionId: string
) => {
  // Get target player ID based on 'self' or 'opponent'
  let targetId = getTargetId(stateChange.target, playerId, gameState);
  
  // If target doesn't exist in game state, skip this effect
  if (!targetId || !gameState.players[targetId]) {
    console.error(`[Game Reducer] Target '${stateChange.target}' could not be mapped to a valid player ID`);
    return null;
  }
  
  // Default timing
  const timing = stateChange.timing || 'immediate';
  
  // Map the action type to game engine effect type
  switch (stateChange.action) {
    case 'REMOVE_HP':
      return {
        id: crypto.randomUUID(),
        type: 'damage',
        value: stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        narration: stateChange.narration // Include narration in the effect
      };
      
    case 'ADD_HP':
      return {
        id: crypto.randomUUID(),
        type: 'heal',
        value: stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        narration: stateChange.narration
      };
      
    case 'ADD_BLOCK':
      return {
        id: crypto.randomUUID(),
        type: 'block',
        value: stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        narration: stateChange.narration
      };
      
    case 'REMOVE_BLOCK':
      return {
        id: crypto.randomUUID(),
        type: 'remove_block',
        value: stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        narration: stateChange.narration
      };
      
    case 'ADD_ENERGY':
    case 'REMOVE_ENERGY':
      return {
        id: crypto.randomUUID(),
        type: 'energy',
        // For REMOVE_ENERGY, we make the value negative
        value: stateChange.action === 'ADD_ENERGY' ? stateChange.value : -stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        narration: stateChange.narration
      };
      
    case 'DRAW':
      return {
        id: crypto.randomUUID(),
        type: 'draw',
        value: stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        narration: stateChange.narration
      };
      
    case 'DISCARD':
      return {
        id: crypto.randomUUID(),
        type: 'discard',
        value: stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        narration: stateChange.narration
      };
      
    case 'ADD_STATUS_EFFECT':
      return {
        id: crypto.randomUUID(),
        type: 'status',
        value: stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        statusName: stateChange.statusName,
        statusDescription: stateChange.statusDescription,
        duration: stateChange.duration,
        narration: stateChange.narration
      };
      
    case 'REMOVE_STATUS_EFFECT':
      return {
        id: crypto.randomUUID(),
        type: 'remove_status',
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        statusName: stateChange.statusName,
        narration: stateChange.narration
      };
      
    case 'MODIFY_STATUS_EFFECT':
      return {
        id: crypto.randomUUID(),
        type: 'modify_status',
        value: stateChange.value,
        source: playerId,
        target: targetId,
        card: cardId,
        timing,
        actionId,
        statusName: stateChange.statusName,
        duration: stateChange.duration,
        narration: stateChange.narration
      };
      
    default:
      console.error(`[Game Reducer] Unknown action type: ${stateChange.action}`);
      return null;
  }
};

/**
 * Helper function to map 'self' or 'opponent' to actual player IDs
 */
const getTargetId = (target: string, playerId: string, gameState: GameState): string | null => {
  if (target === 'self') {
    return playerId;
  } else if (target === 'opponent') {
    // Find opponent ID
    return Object.keys(gameState.players).find(id => id !== playerId) || null;
  } else {
    // In case the target is already an actual player ID
    return target;
  }
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
  let newState = { ...state, phase: PHASES.TURN_END };
  
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
    phase: PHASES.TURN_START
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
  if (state.phase === PHASES.INIT) {
    return {
      ...newState,
      phase: PHASES.ACTION
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
