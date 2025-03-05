import { Card } from '@/types';
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
    console.log(`[EffectInterpreter] Starting interpretation for card: ${context.card.name} (${context.card.id})`);
    console.log(`[EffectInterpreter] Player: ${context.playerId}, Target: ${context.targetId || 'not specified'}`);
    console.log(`[EffectInterpreter] Card base effects: ${JSON.stringify(context.card.base_effects)}`);
    console.log(`[EffectInterpreter] Card wildcard effect: ${context.card.wildcard_effect}`);
    
    // Create the prompt for effect interpretation
    const prompt = this.createEffectInterpretationPrompt(context);
    console.log(`[EffectInterpreter] Generated prompt: ${prompt}`);

    console.log(`[EffectInterpreter] Calling LLM with temperature 0.3...`);
    // Call the LLM with the prompt
    const response = await this.llmClient.complete(prompt, {
      temperature: 0.3, // Lower temperature for more consistent interpretations
      systemPrompt: this.getEffectInterpretationSystemPrompt(),
    });
    console.log(`[EffectInterpreter] Received LLM response with ${response.content.length} characters`);
    console.log(`[EffectInterpreter] Model used: ${response.model}, Tokens: ${response.totalTokens}`);

    // Parse the response to extract interpreted effects
    console.log(`[EffectInterpreter] Parsing response to extract effects...`);
    const interpretation = this.parseEffectInterpretation(response.content);
    console.log(`[EffectInterpreter] Parsed ${interpretation.base_effects.length} base effects and ${interpretation.wildcard_effect.length} wildcard effects`);
    console.log(`[EffectInterpreter] Base effects: ${JSON.stringify(interpretation.base_effects)}`);
    console.log(`[EffectInterpreter] Wildcard effects: ${JSON.stringify(interpretation.wildcard_effect)}`);
    console.log(`[EffectInterpreter] Narrative: "${interpretation.narrative}"`);

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
      console.log(`[EffectInterpreter] Starting to parse LLM response...`);
      
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`[EffectInterpreter] No valid JSON found in the response`);
        console.log(`[EffectInterpreter] Raw response content: ${content}`);
        throw new Error('No valid JSON found in the response');
      }

      const jsonContent = jsonMatch[0];
      console.log(`[EffectInterpreter] Extracted JSON content: ${jsonContent}`);
      
      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
        console.log(`[EffectInterpreter] Successfully parsed JSON`);
      } catch (parseError) {
        console.error(`[EffectInterpreter] JSON.parse error: ${(parseError as Error).message}`);
        console.log(`[EffectInterpreter] Invalid JSON content: ${jsonContent}`);
        throw parseError;
      }

      // Validate the response format with detailed logging
      console.log(`[EffectInterpreter] Validating response format...`);
      console.log(`[EffectInterpreter] Response keys: ${Object.keys(parsed).join(', ')}`);
      
      if (!parsed.base_effects) {
        console.error(`[EffectInterpreter] base_effects key missing in response`);
        throw new Error('Invalid response format: base_effects array not found');
      }
      
      if (!Array.isArray(parsed.base_effects)) {
        console.error(`[EffectInterpreter] base_effects is not an array, type: ${typeof parsed.base_effects}`);
        throw new Error('Invalid response format: base_effects is not an array');
      }
      
      console.log(`[EffectInterpreter] base_effects array validation passed`);

      if (!parsed.wildcard_effect) {
        console.error(`[EffectInterpreter] wildcard_effect key missing in response`);
        throw new Error('Invalid response format: wildcard_effect array not found');
      }
      
      if (!Array.isArray(parsed.wildcard_effect)) {
        console.error(`[EffectInterpreter] wildcard_effect is not an array, type: ${typeof parsed.wildcard_effect}`);
        throw new Error('Invalid response format: wildcard_effect is not an array');
      }
      
      console.log(`[EffectInterpreter] wildcard_effect array validation passed`);

      if (!parsed.narrative) {
        console.error(`[EffectInterpreter] narrative key missing in response`);
        throw new Error('Invalid response format: narrative string not found');
      }
      
      if (typeof parsed.narrative !== 'string') {
        console.error(`[EffectInterpreter] narrative is not a string, type: ${typeof parsed.narrative}`);
        throw new Error('Invalid response format: narrative is not a string');
      }
      
      console.log(`[EffectInterpreter] narrative validation passed`);
      console.log(`[EffectInterpreter] Response format validation complete`);

      return {
        base_effects: parsed.base_effects,
        wildcard_effect: parsed.wildcard_effect,
        narrative: parsed.narrative
      };
    } catch (error) {
      console.error(`[EffectInterpreter] Failed to parse effect interpretation: ${(error as Error).message}`);
      console.log(`[EffectInterpreter] Raw response length: ${content.length} characters`);
      console.log(`[EffectInterpreter] First 200 chars of raw response: ${content.substring(0, 200)}`);
      if (content.length > 400) {
        console.log(`[EffectInterpreter] Last 200 chars of raw response: ${content.substring(content.length - 200)}`);
      }
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