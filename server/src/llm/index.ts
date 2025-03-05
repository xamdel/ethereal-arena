// Export types and classes
export { LLMClient, LLMResponse, LLMAPIError } from './api-client';
export { CardGenerator } from './card-generator';
export { EffectInterpreter, InterpretedEffect } from './effect-interpreter';

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
  const { effectInterpreter } = await import('./effect-interpreter');
  return effectInterpreter.interpretCardEffects({
    card,
    playerId,
    gameState
  });
}