// Export types and classes
export { LLMClient, LLMResponse, LLMAPIError } from './api-client';
export { CardGenerator } from './card-generator';
export { EffectInterpreter, StateChangeAction, EffectInterpretationStreamEvent } from './effect-interpreter';

// Export singleton instances
import { llmClient } from './api-client';
import { cardGenerator } from './card-generator';
import { EffectInterpretationStreamEvent, effectInterpreter, StateChangeAction } from './effect-interpreter';

export { llmClient, cardGenerator, effectInterpreter };

// Convenience function to generate a batch of cards
export async function generateCards(count: number = 5, playerContext?: any) {
  const { cardGenerator } = await import('./card-generator');
  return cardGenerator.generateCards({
    count,
    playerContext
  });
}

// Convenience function to calculate energy cost for a card (used when highlighting a card)
export async function calculateCardEnergyCost(card: any, playerId: string, gameState: any): Promise<{
  canPlay: boolean;
  energyCost: number;
  reason: string;
  fromCache?: boolean;
}> {
  console.log(`[LLM] calculateCardEnergyCost called for card: ${card.name} (${card.id})`);
  console.log(`[LLM] Player ID: ${playerId}`);
  
  const { effectInterpreter } = await import('./effect-interpreter');
  
  try {
    console.log(`[LLM] Calling effectInterpreter.calculateCardEnergyCost...`);
    const result = await effectInterpreter().calculateCardEnergyCost({
      card,
      playerId,
      gameState
    });
    
    console.log(`[LLM] Cost calculation completed successfully`);
    console.log(`[LLM] Energy cost: ${result.energyCost} (${result.canPlay ? 'can play' : 'cannot play'})`);
    console.log(`[LLM] Reason: ${result.reason}`);
    console.log(`[LLM] From cache: ${result.fromCache ? 'Yes' : 'No'}`);
    
    return result;
  } catch (error) {
    console.error(`[LLM] Error in calculateCardEnergyCost: ${(error as Error).message}`);
    // Return a fallback value based on the card's base cost
    return {
      canPlay: gameState.players[playerId].energy >= card.cost,
      energyCost: card.cost,
      reason: "Error calculating energy cost, using base cost"
    };
  }
}

// Clear cost cache for a player (call this when game state changes)
export async function clearCardEnergyCostCache(playerId: string): Promise<void> {
  console.log(`[LLM] Clearing card energy cost cache for player: ${playerId}`);
  
  const { effectInterpreter } = await import('./effect-interpreter');
  effectInterpreter().clearCostCacheForPlayer(playerId);
}

// Convenience function to interpret a card's effects
export async function interpretCardEffects(card: any, playerId: string, gameState: any): Promise<{
  stateChanges: StateChangeAction[];
  narrative: string;
  canPlayCard: boolean;
}> {
  console.log(`[LLM] interpretCardEffects called for card: ${card.name} (${card.id})`);
  console.log(`[LLM] Player ID: ${playerId}`);
  console.log(`[LLM] Game state contains ${Object.keys(gameState.players).length} players`);
  console.log(`[LLM] Target ID included in game state: ${gameState.targetId || 'none'}`);
  
  const { effectInterpreter } = await import('./effect-interpreter');
  
  try {
    console.log(`[LLM] Calling effectInterpreter.interpretCardEffects...`);
    const result = await effectInterpreter().interpretCardEffects({
      card,
      playerId,
      targetId: gameState.targetId,
      gameState
    });
    
    console.log(`[LLM] Effect interpretation completed successfully`);
    console.log(`[LLM] Can play card: ${result.canPlayCard}`);
    console.log(`[LLM] Returned ${result.stateChanges.length} state changes`);
    
    return result;
  } catch (error) {
    console.error(`[LLM] Error in interpretCardEffects: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Stream the interpretation of card effects
 * Returns an async generator that yields interpretation events
 */
export async function* streamCardEffects(card: any, playerId: string, gameState: any): AsyncGenerator<EffectInterpretationStreamEvent, void, unknown> {
  console.log(`[LLM] streamCardEffects called for card: ${card.name} (${card.id})`);
  console.log(`[LLM] Player ID: ${playerId}`);
  console.log(`[LLM] Game state contains ${Object.keys(gameState.players).length} players`);
  console.log(`[LLM] Target ID included in game state: ${gameState.targetId || 'none'}`);
  
  const { effectInterpreter } = await import('./effect-interpreter');
  
  try {
    console.log(`[LLM] Calling effectInterpreter.interpretCardEffectsStreaming...`);
    
    yield* effectInterpreter().interpretCardEffectsStreaming({
      card,
      playerId,
      targetId: gameState.targetId,
      gameState
    });
    
  } catch (error) {
    console.error(`[LLM] Error in streamCardEffects: ${(error as Error).message}`);
    
    // Yield an error event
    yield {
      type: 'error',
      content: `Error streaming card effects: ${(error as Error).message}`,
      complete: true
    };
  }
}