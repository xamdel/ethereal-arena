/**
 * Pure functions for common game state operations
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  GameState, 
  Player, 
  Card, 
  StatusEffect, 
  QueuedEffect,
  ActionType 
} from '../types';

/**
 * Create a new empty game state
 */
export const createInitialGameState = (gameId: string, isMultiplayer: boolean = false): GameState => {
  return {
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
    isMultiplayer
  };
};

/**
 * Add a player to the game state
 */
export const addPlayer = (
  state: GameState, 
  playerId: string, 
  playerName: string, 
  isAI: boolean = false
): GameState => {
  // Create the new player
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    hp: 80, // From game design
    maxHp: 80,
    block: 0,
    energy: 5,
    maxEnergy: 5,
    draw: 5,
    hand: [], // Cards currently in hand
    discard: [], // Cards played this turn
    statusEffects: [],
    isActive: false,
    isAI
  };
  
  // Create a new state with the player added
  const newState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: newPlayer
    }
  };
  
  // If this is the first player, set them as active
  if (Object.keys(state.players).length === 0) {
    newState.activePlayerId = playerId;
    newState.players[playerId].isActive = true;
  }
  
  return newState;
};

/**
 * Add cards to a player's hand (typically from LLM generation)
 */
export const addCardsToHand = (
  state: GameState, 
  playerId: string, 
  cards: Card[]
): GameState => {
  if (!state.players[playerId]) {
    return state;
  }
  
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        hand: [...state.players[playerId].hand, ...cards]
      }
    }
  };
};

/**
 * Select initial cards from a generated pool
 * Used at the start of the game when player chooses 5 out of 10 generated cards
 */
export const selectInitialCards = (
  state: GameState,
  playerId: string,
  selectedCardIds: string[]
): GameState => {
  if (!state.players[playerId]) {
    return state;
  }
  
  const player = state.players[playerId];
  
  // Filter the hand to keep only the selected cards
  const newHand = player.hand.filter(card => selectedCardIds.includes(card.id));
  
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: newHand
      }
    }
  };
};

/**
 * Apply damage to a player
 */
export const applyDamage = (
  state: GameState, 
  targetPlayerId: string, 
  damage: number
): GameState => {
  if (!state.players[targetPlayerId]) {
    return state;
  }
  
  const player = state.players[targetPlayerId];
  
  // Apply block first
  let remainingDamage = damage;
  let newBlock = player.block;
  
  if (player.block > 0) {
    if (player.block >= damage) {
      newBlock -= damage;
      remainingDamage = 0;
    } else {
      remainingDamage -= player.block;
      newBlock = 0;
    }
  }
  
  // Apply remaining damage to HP
  const newHp = Math.max(0, player.hp - remainingDamage);
  
  // Check for game over
  let winner = state.winner;
  if (newHp === 0 && !winner) {
    // The other player wins
    const otherPlayerId = Object.keys(state.players).find(id => id !== targetPlayerId);
    if (otherPlayerId) {
      winner = otherPlayerId;
    }
  }
  
  return {
    ...state,
    players: {
      ...state.players,
      [targetPlayerId]: {
        ...player,
        hp: newHp,
        block: newBlock
      }
    },
    winner
  };
};

/**
 * Apply block to a player
 */
export const applyBlock = (
  state: GameState, 
  targetPlayerId: string, 
  blockAmount: number
): GameState => {
  if (!state.players[targetPlayerId]) {
    return state;
  }
  
  const player = state.players[targetPlayerId];
  
  return {
    ...state,
    players: {
      ...state.players,
      [targetPlayerId]: {
        ...player,
        block: player.block + blockAmount
      }
    }
  };
};

/**
 * Apply a status effect to a player
 */
export const applyStatusEffect = (
  state: GameState, 
  targetPlayerId: string, 
  statusEffect: StatusEffect
): GameState => {
  if (!state.players[targetPlayerId]) {
    return state;
  }
  
  const player = state.players[targetPlayerId];
  
  // Check if the player already has this status effect
  const existingEffect = player.statusEffects.find(effect => effect.name === statusEffect.name);
  
  let newStatusEffects: StatusEffect[];
  
  if (existingEffect) {
    // Update the existing effect (e.g., refresh duration)
    newStatusEffects = player.statusEffects.map(effect => 
      effect.name === statusEffect.name 
        ? { ...effect, duration: Math.max(effect.duration, statusEffect.duration) }
        : effect
    );
  } else {
    // Add the new effect
    newStatusEffects = [...player.statusEffects, statusEffect];
  }
  
  return {
    ...state,
    players: {
      ...state.players,
      [targetPlayerId]: {
        ...player,
        statusEffects: newStatusEffects
      }
    }
  };
};

/**
 * Use energy from a player
 */
export const useEnergy = (
  state: GameState, 
  playerId: string, 
  amount: number
): GameState => {
  if (!state.players[playerId]) {
    return state;
  }
  
  const player = state.players[playerId];
  
  if (player.energy < amount) {
    // Not enough energy
    return state;
  }
  
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        energy: player.energy - amount
      }
    }
  };
};

/**
 * Reset energy to maximum
 */
export const resetEnergy = (
  state: GameState, 
  playerId: string
): GameState => {
  if (!state.players[playerId]) {
    return state;
  }
  
  const player = state.players[playerId];
  
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        energy: player.maxEnergy
      }
    }
  };
};

/**
 * Play a card from a player's hand
 */
export const playCard = (
  state: GameState, 
  playerId: string, 
  cardId: string
): { state: GameState; playedCard: Card | null } => {
  if (!state.players[playerId]) {
    return { state, playedCard: null };
  }
  
  const player = state.players[playerId];
  
  // Find the card in the player's hand
  const cardIndex = player.hand.findIndex(card => card.id === cardId);
  
  if (cardIndex === -1) {
    // Card not found
    return { state, playedCard: null };
  }
  
  const card = player.hand[cardIndex];
  
  // Check if player has enough energy
  if (player.energy < card.cost) {
    // Not enough energy
    return { state, playedCard: null };
  }
  
  // Remove the card from hand
  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);
  
  // Add card to discard pile (played this turn)
  const newDiscard = [...player.discard, card];
  
  // Use energy
  const newEnergy = player.energy - card.cost;
  
  // Update the player
  const newState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: newHand,
        discard: newDiscard,
        energy: newEnergy
      }
    }
  };
  
  return { state: newState, playedCard: card };
};

/**
 * Add an effect to the queue
 */
export const addEffectToQueue = (
  state: GameState, 
  effect: Omit<QueuedEffect, 'id' | 'timestamp'>
): GameState => {
  const newEffect: QueuedEffect = {
    ...effect,
    id: uuidv4(),
    timestamp: Date.now()
  };
  
  return {
    ...state,
    effectQueue: [...state.effectQueue, newEffect]
  };
};

/**
 * Process the next effect in the queue
 */
export const processNextEffect = (
  state: GameState
): GameState => {
  if (state.effectQueue.length === 0) {
    return state;
  }
  
  // Get the next effect (oldest first)
  const [effect, ...remainingEffects] = [...state.effectQueue].sort((a, b) => a.timestamp - b.timestamp);
  
  // Process the effect based on its type
  let newState = {
    ...state,
    effectQueue: remainingEffects
  };
  
  switch (effect.type) {
    case 'damage':
      if (effect.value !== undefined && effect.target) {
        newState = applyDamage(newState, effect.target, effect.value);
      }
      break;
      
    case 'block':
      if (effect.value !== undefined && effect.target) {
        newState = applyBlock(newState, effect.target, effect.value);
      }
      break;
      
    case 'status':
      if (effect.target && effect.statusName && effect.duration !== undefined) {
        const statusEffect: StatusEffect = {
          id: uuidv4(),
          name: effect.statusName,
          description: effect.statusDescription || effect.statusName,
          duration: effect.duration
        };
        newState = applyStatusEffect(newState, effect.target, statusEffect);
      }
      break;
      
    // Add more effect types as needed
    
    default:
      // Unknown effect type, just remove it from the queue
      break;
  }
  
  return newState;
};

/**
 * Process all effects in the queue
 */
export const processAllEffects = (
  state: GameState
): GameState => {
  let currentState = { ...state };
  
  // Process effects until the queue is empty
  while (currentState.effectQueue.length > 0) {
    currentState = processNextEffect(currentState);
  }
  
  return currentState;
};

/**
 * Switch the active player
 */
export const switchActivePlayer = (
  state: GameState
): GameState => {
  const playerIds = Object.keys(state.players);
  
  if (playerIds.length < 2 || state.winner) {
    // Can't switch if there's only one player or the game is over
    return state;
  }
  
  // Find the current active player
  const currentActivePlayer = playerIds.find(id => state.players[id].isActive);
  
  if (!currentActivePlayer) {
    // No active player, set the first one
    const newActivePlayerId = playerIds[0];
    return {
      ...state,
      activePlayerId: newActivePlayerId,
      players: {
        ...state.players,
        [newActivePlayerId]: {
          ...state.players[newActivePlayerId],
          isActive: true
        }
      }
    };
  }
  
  // Find the next player
  const currentIndex = playerIds.indexOf(currentActivePlayer);
  const nextIndex = (currentIndex + 1) % playerIds.length;
  const nextActivePlayerId = playerIds[nextIndex];
  
  // Update the players
  const newPlayers = { ...state.players };
  Object.keys(newPlayers).forEach(id => {
    newPlayers[id] = {
      ...newPlayers[id],
      isActive: id === nextActivePlayerId
    };
  });
  
  return {
    ...state,
    activePlayerId: nextActivePlayerId,
    players: newPlayers,
    turnNumber: state.turnNumber + 1,
    turnStartTime: Date.now()
  };
};

/**
 * Clear the hand and discard pile at the end of a turn
 * The LLM will generate new cards at the start of the next turn
 */
export const clearCardsAtEndOfTurn = (
  state: GameState,
  playerId: string
): GameState => {
  if (!state.players[playerId]) {
    return state;
  }
  
  const player = state.players[playerId];
  
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: [],
        discard: []
      }
    }
  };
};

/**
 * Reset block for all players at end of turn
 */
export const resetBlockAtEndOfTurn = (
  state: GameState
): GameState => {
  const newPlayers = { ...state.players };
  
  Object.keys(newPlayers).forEach(id => {
    newPlayers[id] = {
      ...newPlayers[id],
      block: 0
    };
  });
  
  return {
    ...state,
    players: newPlayers
  };
};

/**
 * Update status effect durations at turn end
 */
export const updateStatusEffects = (
  state: GameState
): GameState => {
  const newPlayers = { ...state.players };
  
  Object.keys(newPlayers).forEach(id => {
    // Reduce duration of each status effect
    const updatedStatusEffects = newPlayers[id].statusEffects
      .map(effect => ({
        ...effect,
        duration: effect.duration - 1
      }))
      // Remove effects with duration <= 0
      .filter(effect => effect.duration > 0);
    
    newPlayers[id] = {
      ...newPlayers[id],
      statusEffects: updatedStatusEffects
    };
  });
  
  return {
    ...state,
    players: newPlayers
  };
};

/**
 * Game state serialization
 */
export const serializeGameState = (state: GameState): string => {
  return JSON.stringify(state);
};

/**
 * Game state deserialization
 */
export const deserializeGameState = (serialized: string): GameState => {
  return JSON.parse(serialized);
};

/**
 * Validate game state
 */
export const validateGameState = (state: GameState): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Basic structure validation
  if (!state.id) {
    errors.push('Game state missing ID');
  }
  
  if (!state.players || typeof state.players !== 'object') {
    errors.push('Invalid players object');
  }
  
  // Player validation
  Object.values(state.players).forEach(player => {
    if (!player.id) {
      errors.push(`Player missing ID`);
    }
    
    if (player.hp < 0) {
      errors.push(`Player ${player.id} has negative HP`);
    }
    
    if (player.energy < 0) {
      errors.push(`Player ${player.id} has negative energy`);
    }
  });
  
  // Active player validation
  if (state.activePlayerId && !state.players[state.activePlayerId]) {
    errors.push('Active player ID does not match any player');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};