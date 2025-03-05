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
 * Generate cards for a player's turn using the LLM service
 */
export const generateCards = async (
  state: GameState, 
  playerId: string, 
  count: number,
  isFirstTurn: boolean = false
): Promise<GameState> => {
  if (!state.players[playerId]) {
    console.error('Player not found for card generation');
    return state;
  }
  
  console.log(`[Card Generation] Generating ${count} cards for player ${playerId}`);
  
  try {
    // Import the LLM service
    const { llmService } = await import('../game-engine/llm-service');
    
    // Convert game state to the format expected by the LLM service
    const llmGameState = {
      players: Object.entries(state.players).reduce((acc, [id, player]) => {
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
      activePlayerId: state.activePlayerId,
      turn: state.turnNumber,
      phase: state.phase
    };
    
    console.log(`[Card Generation] Calling LLM service with context:
      - Player HP: ${state.players[playerId].hp}/${state.players[playerId].maxHp}
      - Turn: ${state.turnNumber}
      - Phase: ${state.phase}
    `);
    
    // Try to generate cards using the LLM service
    try {
      // Call the LLM service to generate cards
      const generatedCards = await llmService.generateCardsForPlayer(
        playerId,
        llmGameState,
        count
      );
      
      console.log(`[Card Generation] Successfully generated ${generatedCards.length} cards from LLM service`);
      console.log(`[Card Generation] First card: ${generatedCards[0]?.name || 'None'}`);
      
      // Add the generated cards to the player's hand
      return stateHelpers.addCardsToHand(state, playerId, generatedCards);
    } catch (error) {
      console.error('[Card Generation] Error generating cards with LLM service:', error);
      console.log('[Card Generation] Falling back to mock card generation');
      
      // Fall back to mock card generation if the LLM service fails
      const mockCards: Card[] = Array(count).fill(0).map((_, index) => {
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
          createdBy: 'mock-fallback'
        };
      });
      
      console.log(`[Card Generation] Generated ${mockCards.length} mock fallback cards`);
      
      // Add the mock cards to the player's hand
      return stateHelpers.addCardsToHand(state, playerId, mockCards);
    }
  } catch (error) {
    console.error('[Card Generation] Critical error in card generation:', error);
    
    // In case of a critical error, return the state unchanged
    return state;
  }
}

/**
 * Process the draw phase for the current active player
 * Generates cards based on the player's draw stat
 */
export const processDraw = async (state: GameState): Promise<GameState> => {
  if (!state.activePlayerId || !state.players[state.activePlayerId]) {
    console.error('[TurnManager] No active player for draw phase');
    return state;
  }
  
  console.log(`[TurnManager] Processing draw phase for player: ${state.activePlayerId}`);
  
  const activePlayer = state.players[state.activePlayerId];
  const isFirstTurn = state.turnNumber <= Object.keys(state.players).length;
  
  console.log(`[TurnManager] Is first turn: ${isFirstTurn}, Turn number: ${state.turnNumber}, Player count: ${Object.keys(state.players).length}`);
  
  // Generate cards based on draw stat or first turn rules
  const cardCount = isFirstTurn ? 10 : activePlayer.draw;
  console.log(`[TurnManager] Generating ${cardCount} cards for player ${state.activePlayerId}`);
  
  try {
    // Generate cards for the player using the LLM service (or fallback to mock cards)
    let newState = await generateCards(state, state.activePlayerId, cardCount, isFirstTurn);
    
    // Check if cards were added
    const handSize = newState.players[state.activePlayerId].hand.length;
    console.log(`[TurnManager] Player hand size after generation: ${handSize}`);
    
    // If it's the first turn, stay in the draw phase so the player can select cards
    // Otherwise, move to the action phase
    newState.phase = isFirstTurn ? TurnPhase.DRAW : TurnPhase.ACTION;
    
    return newState;
  } catch (error) {
    console.error('[TurnManager] Error in processDraw:', error);
    // Return original state if there was an error
    return state;
  }
};

/**
 * End the current player's turn
 */
export const endTurn = async (state: GameState): Promise<GameState> => {
  if (!state.activePlayerId) {
    console.error('[TurnManager] No active player to end turn for');
    return state;
  }
  
  console.log(`[TurnManager] Ending turn for player: ${state.activePlayerId}`);
  
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
  
  try {
    // Process the end turn action through the reducer - now async
    console.log(`[TurnManager] Processing END_TURN action`);
    return await gameReducer(state, endTurnAction);
  } catch (error) {
    console.error(`[TurnManager] Error ending turn:`, error);
    return state;
  }
};

/**
 * Process a full turn sequence automatically
 * Used for AI players or automated turn transitions
 * Now supports async operations
 */
export const processFullTurn = async (state: GameState): Promise<GameState> => {
  if (!state.activePlayerId || !state.players[state.activePlayerId]) {
    console.error('[TurnManager] No active player for turn processing');
    return state;
  }
  
  console.log(`[TurnManager] Processing full turn for player: ${state.activePlayerId}`);
  
  try {
    // Start turn
    let currentState = startTurn(state);
    
    // Process draw phase - async
    console.log(`[TurnManager] Processing draw phase`);
    currentState = await processDraw(currentState);
    
    // If it's a first turn, the player would select cards here
    // For now, we'll skip this selection for simplicity
    
    // End turn (this will handle the phase transitions) - async
    console.log(`[TurnManager] Ending turn`);
    currentState = await endTurn(currentState);
    
    return currentState;
  } catch (error) {
    console.error('[TurnManager] Error processing full turn:', error);
    return state;
  }
};