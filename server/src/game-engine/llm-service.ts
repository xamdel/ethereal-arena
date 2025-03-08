import { Card } from '@/types';
import { generateCards, interpretCardEffects, StateChangeAction } from '../llm';

/**
 * Interface for the game state expected by the LLM service
 */
export interface LLMGameState {
  players: {
    [playerId: string]: {
      id: string;
      hp: number;
      maxHp: number;
      block: number;
      energy: number;
      statusEffects: {
        id: string;
        name: string;
        description: string;
        duration: number;
      }[];
    };
  };
  activePlayerId: string;
  turn: number;
  phase: string;
}

/**
 * Service for handling LLM interactions in the game engine
 */
export class LLMService {
  /**
   * Clear the energy cost cache for a player
   * Should be called whenever game state changes (e.g., when a card is played)
   */
  async clearCardEnergyCostCache(playerId: string): Promise<void> {
    console.log(`[LLMService] Clearing card energy cost cache for player ${playerId}`);
    
    try {
      // Import dynamically to avoid circular dependencies
      const { clearCardEnergyCostCache } = await import('../llm');
      await clearCardEnergyCostCache(playerId);
    } catch (error) {
      console.error(`[LLMService] Error clearing card energy cost cache: ${(error as Error).message}`);
    }
  }
  /**
   * Generate cards for a player
   */
  async generateCardsForPlayer(
    playerId: string,
    gameState: LLMGameState,
    count: number = 5
  ): Promise<Card[]> {
    console.log(`LLM Service: Generating ${count} cards for player ${playerId}`);
    console.log(`Game state has ${Object.keys(gameState.players).length} players`);
    
    const player = gameState.players[playerId];
    
    if (!player) {
      console.error(`Player with ID ${playerId} not found in game state`);
      throw new Error(`Player with ID ${playerId} not found in game state`);
    }
    
    console.log(`Creating context for player: HP=${player.hp}/${player.maxHp}, Block=${player.block}, Energy=${player.energy}`);
    
    // Create player context for card generation
    const playerContext = {
      hp: player.hp,
      maxHp: player.maxHp,
      block: player.block,
      energy: player.energy,
      statusEffects: player.statusEffects?.map(effect => ({
        name: effect.name,
        description: effect.description,
        duration: effect.duration
      })) || []
    };
    
    console.log(`Calling card generator to generate ${count} cards...`);
    
    try {
      // Generate cards
      const cards = await generateCards(count, playerContext);
      console.log(`Successfully generated ${cards.length} cards`);
      return cards;
    } catch (error) {
      console.error('Error in card generation:', error);
      throw error;
    }
  }
  
  /**
   * Calculate energy cost for a card
   * Used when a card is highlighted to pre-calculate if it can be played
   */
  async calculateCardEnergyCost(
    card: Card,
    playerId: string,
    gameState: LLMGameState
  ): Promise<{
    canPlay: boolean;
    energyCost: number;
    reason: string;
  }> {
    console.log(`[LLMService] calculateCardEnergyCost called for card: ${card.name} (${card.id})`);
    console.log(`[LLMService] Player ID: ${playerId}`);
    
    try {
      // Import dynamically to avoid circular dependencies
      const { calculateCardEnergyCost } = await import('../llm');
      
      // Calculate the energy cost
      const result = await calculateCardEnergyCost(card, playerId, gameState);
      
      console.log(`[LLMService] Energy cost calculation completed successfully`);
      console.log(`[LLMService] Energy cost: ${result.energyCost}, Can play: ${result.canPlay}`);
      
      return result;
    } catch (error) {
      console.error(`[LLMService] Error calculating card energy cost: ${(error as Error).message}`);
      // Fallback to basic cost check
      const player = gameState.players[playerId];
      return {
        canPlay: player.energy >= card.cost,
        energyCost: card.cost,
        reason: "Using base cost due to calculation error"
      };
    }
  }
  
  /**
   * Interpret the effects of a played card
   * Now returns stateChanges array in the new format
   * Note: Energy costs are now handled separately in the game reducer
   */
  async interpretCardEffects(
    card: Card,
    playerId: string,
    gameState: LLMGameState,
    targetId?: string
  ): Promise<{
    stateChanges: any[];
    narrative: string;
    canPlayCard: boolean;
  }> {
    console.log(`[LLMService] interpretCardEffects called for card: ${card.name} (${card.id})`);
    console.log(`[LLMService] Player ID: ${playerId}, Target ID: ${targetId || 'not specified'}`);
    console.log(`[LLMService] Game state has ${Object.keys(gameState.players).length} players`);
    console.log(`[LLMService] Game turn: ${gameState.turn}, Phase: ${gameState.phase}`);
    console.log(`[LLMService] Card base effects: ${card.base_effects}`);
    console.log(`[LLMService] Card has wildcard effect: ${!!card.wildcard_effect}`);
    
    try {
      // Call the effect interpreter with the required context
      const result = await interpretCardEffects(card, playerId, {
        ...gameState,
        // If targetId is provided, add it to the context
        targetId
      });
      
      console.log(`[LLMService] Card effect interpretation completed successfully`);
      console.log(`[LLMService] Can play card: ${result.canPlayCard}`);
      console.log(`[LLMService] Received ${result.stateChanges?.length || 0} state changes`);
      
      return {
        stateChanges: result.stateChanges || [],
        narrative: result.narrative,
        canPlayCard: result.canPlayCard
      };
    } catch (error) {
      console.error(`[LLMService] Error interpreting card effects: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * Generate a narrative for the current game state
   * This can be used for creating commentary or status updates
   */
  async generateNarrative(
    gameState: LLMGameState,
    previousAction?: string
  ): Promise<string> {
    const { llmClient } = await import('../llm/api-client');
    
    const prompt = `Generate a brief narrative description of the current state of this card battle game:

GAME STATE:
- Turn: ${gameState.turn}
- Active player: ${gameState.players[gameState.activePlayerId]?.id || 'Unknown'}

${Object.values(gameState.players).map(player => `
PLAYER ${player.id}:
- HP: ${player.hp}/${player.maxHp}
- Block: ${player.block}
- Status effects: ${player.statusEffects.length > 0 ? 
        player.statusEffects.map(effect => 
          `${effect.name} (${effect.description}, ${effect.duration} turns)`
        ).join(', ') : 'None'}
`).join('\n')}

${previousAction ? `Previous action: ${previousAction}` : ''}

Create a brief, engaging narrative (1-2 sentences) describing the current situation. Focus on tension, strategy, and the current state of the battle.`;

    const response = await llmClient.complete(prompt, {
      temperature: 0.7,
      maxTokens: 100,
    });
    
    return response.content.trim();
  }
}

// Export a singleton instance for convenience
export const llmService = new LLMService();