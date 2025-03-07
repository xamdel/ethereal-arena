// Export types and classes
export { LLMClient, LLMResponse, LLMAPIError } from './api-client';
export { CardGenerator } from './card-generator';
export { EffectInterpreter, StateChangeAction } from './effect-interpreter';

// Export singleton instances
import { llmClient } from './api-client';
import { cardGenerator } from './card-generator';
import { effectInterpreter } from './effect-interpreter';

export { llmClient, cardGenerator, effectInterpreter };

// Convenience function to generate a batch of cards
export async function generateCards(count: number = 5, playerContext?: any) {
  const { cardGenerator } = await import('./card-generator');
  return cardGenerator.generateCards({
    count,
    playerContext
  });
}

// Convenience function to interpret a card's effects
export async function interpretCardEffects(card: any, playerId: string, gameState: any) {
  console.log(`[LLM] interpretCardEffects called for card: ${card.name} (${card.id})`);
  console.log(`[LLM] Player ID: ${playerId}`);
  console.log(`[LLM] Game state contains ${Object.keys(gameState.players).length} players`);
  console.log(`[LLM] Target ID included in game state: ${gameState.targetId || 'none'}`);
  
  const { effectInterpreter } = await import('./effect-interpreter');
  
  try {
    console.log(`[LLM] Calling effectInterpreter.interpretCardEffects...`);
    const result = await effectInterpreter.interpretCardEffects({
      card,
      playerId,
      targetId: gameState.targetId,
      gameState
    });
    
    console.log(`[LLM] Effect interpretation completed successfully`);
    console.log(`[LLM] Returned ${result.stateChanges.length} state changes`);
    
    return result;
  } catch (error) {
    console.error(`[LLM] Error in interpretCardEffects: ${(error as Error).message}`);
    throw error;
  }
}