import { Card } from '../../frontend/src/types/game';
import { LLMClient, llmClient } from './api-client';

// Game state interface for effect interpretation
interface GameState {
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

// Card play context
interface CardPlayContext {
  card: Card;
  playerId: string;
  targetId?: string;
  gameState: GameState;
}

// Output from effect interpretation
export interface InterpretedEffect {
  type: string;
  value?: number;
  target: string;
  source: string;
  description: string;
  timing: 'immediate' | 'after-damage' | 'turn-start' | 'turn-end';
  statusName?: string;
  statusDescription?: string;
  duration?: number;
}

// Response format from LLM
interface EffectInterpretationResponse {
  base_effects: InterpretedEffect[];
  wildcard_effect: InterpretedEffect[];
  narrative: string;
}

export class EffectInterpreter {
  private llmClient: LLMClient;

  constructor(client?: LLMClient) {
    this.llmClient = client || llmClient;
  }

  /**
   * Interpret a card's effects in the current game context
   */
  public async interpretCardEffects(context: CardPlayContext): Promise<{
    baseEffects: InterpretedEffect[];
    wildcardEffects: InterpretedEffect[];
    narrative: string;
  }> {
    // Create the prompt for effect interpretation
    const prompt = this.createEffectInterpretationPrompt(context);

    // Call the LLM with the prompt
    const response = await this.llmClient.complete(prompt, {
      temperature: 0.3, // Lower temperature for more consistent interpretations
      systemPrompt: this.getEffectInterpretationSystemPrompt(),
    });

    // Parse the response to extract interpreted effects
    const interpretation = this.parseEffectInterpretation(response.content);

    return {
      baseEffects: interpretation.base_effects,
      wildcardEffects: interpretation.wildcard_effect,
      narrative: interpretation.narrative
    };
  }

  /**
   * Create the system prompt for effect interpretation
   */
  private getEffectInterpretationSystemPrompt(): string {
    return `You are a card game interpreter that translates card effects into specific game actions. 
    
Your role is to:
1. Translate base effects into specific game actions
2. Interpret wildcard effects within the current game context
3. Ensure all interpretations are balanced and fair
4. Provide a narrative description of what happens when the card is played

All responses must be in valid JSON format.`;
  }

  /**
   * Create the user prompt for effect interpretation
   */
  private createEffectInterpretationPrompt(context: CardPlayContext): string {
    const { card, playerId, targetId, gameState } = context;
    const player = gameState.players[playerId];
    const opponent = Object.values(gameState.players).find(p => p.id !== playerId);

    let prompt = `Interpret the effects of the following card in the current game context:

CARD DETAILS:
- Name: ${card.name}
- Cost: ${card.cost}
- Base effects: ${card.base_effects.map(effect => 
      `${effect.effect_type} ${effect.value} (target: ${effect.target})`
    ).join(', ')}
- Wildcard effect: ${card.wildcard_effect}
- Description: ${card.description}

CURRENT GAME STATE:
- Turn: ${gameState.turn}
- Phase: ${gameState.phase}
- Active player: ${gameState.activePlayerId === playerId ? 'Player (card user)' : 'Opponent'}

PLAYER (card user):
- HP: ${player.hp}/${player.maxHp}
- Block: ${player.block}
- Energy: ${player.energy}
- Status effects: ${player.statusEffects.length > 0 ? 
      player.statusEffects.map(effect => 
        `${effect.name} (${effect.description}, ${effect.duration} turns)`
      ).join(', ') : 'None'}

OPPONENT:
- HP: ${opponent?.hp}/${opponent?.maxHp}
- Block: ${opponent?.block}
- Status effects: ${opponent?.statusEffects && opponent.statusEffects.length > 0 ? 
      opponent.statusEffects.map(effect => 
        `${effect.name} (${effect.description}, ${effect.duration} turns)`
      ).join(', ') : 'None'}`;

    // Add target information if available
    if (targetId) {
      prompt += `\n\nSPECIFIC TARGET: ${targetId === playerId ? 'Player (self)' : 'Opponent'}`;
    }

    prompt += `\n\nYour task:
1. Interpret each base effect literally, converting it into a specific game action
2. Interpret the wildcard effect creatively but fairly within the current game context
3. Provide a narrative description of what happens when the card is played

Rules for interpretation:
- Base effects should be interpreted directly (e.g., "damage 10" deals 10 damage)
- Wildcard effects should be reasonably powerful but balanced
- Status effects typically last 2-3 turns
- Valid effect types: damage, block, heal, draw, energy, status_effect
- Valid timing values: immediate, after-damage, turn-start, turn-end
- Always include the player IDs for source and target

Respond with a JSON object containing the interpreted effects. Example format:
{
  "base_effects": [
    {
      "type": "damage",
      "value": 8,
      "target": "${opponent?.id || 'opponent'}",
      "source": "${playerId}",
      "description": "Deals 8 damage to the opponent",
      "timing": "immediate"
    }
  ],
  "wildcard_effect": [
    {
      "type": "status_effect",
      "target": "${opponent?.id || 'opponent'}",
      "source": "${playerId}",
      "description": "Applies Burning status to the opponent",
      "timing": "immediate",
      "statusName": "Burning",
      "statusDescription": "Takes 2 damage at the start of each turn",
      "duration": 2
    }
  ],
  "narrative": "A burst of arcane energy erupts from your hands, striking your opponent with tremendous force. The residual magic ignites their armor, causing it to smolder."
}`;

    return prompt;
  }

  /**
   * Parse the LLM response to extract interpreted effects
   */
  private parseEffectInterpretation(content: string): EffectInterpretationResponse {
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in the response');
      }

      const jsonContent = jsonMatch[0];
      const parsed = JSON.parse(jsonContent);

      // Validate the response format
      if (!parsed.base_effects || !Array.isArray(parsed.base_effects)) {
        throw new Error('Invalid response format: base_effects array not found');
      }

      if (!parsed.wildcard_effect || !Array.isArray(parsed.wildcard_effect)) {
        throw new Error('Invalid response format: wildcard_effect array not found');
      }

      if (!parsed.narrative || typeof parsed.narrative !== 'string') {
        throw new Error('Invalid response format: narrative string not found');
      }

      return {
        base_effects: parsed.base_effects,
        wildcard_effect: parsed.wildcard_effect,
        narrative: parsed.narrative
      };
    } catch (error) {
      console.error('Failed to parse effect interpretation:', error);
      console.log('Raw response:', content);
      throw new Error(`Failed to parse effect interpretation: ${(error as Error).message}`);
    }
  }
}

// Export a lazy-loaded singleton instance for convenience
export const effectInterpreter = (() => {
  let instance: EffectInterpreter | null = null;
  return () => {
    if (!instance) {
      instance = new EffectInterpreter();
    }
    return instance;
  };
})()();