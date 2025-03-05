// Export LLM client
export { LLMClient, llmClient, LLMResponse, LLMAPIError } from './api-client';

// Export card generator
export { CardGenerator, cardGenerator } from './card-generator';

// Export effect interpreter
export { EffectInterpreter, effectInterpreter, InterpretedEffect } from './effect-interpreter';

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