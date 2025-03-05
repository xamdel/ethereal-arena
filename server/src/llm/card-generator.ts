import { v4 as uuidv4 } from 'uuid';
import { LLMClient, llmClient } from './api-client';
import { Card } from '../../frontend/src/types/game';

// Default card generation options
interface CardGenerationOptions {
  temperature?: number;
  count?: number;
  theme?: string;
  playerContext?: PlayerContext;
  excludedEffects?: string[];
  maxEnergyCost?: number;
}

// Context about the current player state
interface PlayerContext {
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  statusEffects?: {
    name: string;
    description: string;
    duration: number;
  }[];
}

// Raw response format from LLM
interface RawCardResponse {
  cards: {
    name: string;
    cost: number;
    base_effects: {
      effect_type: string;
      value: number;
      target: 'opponent' | 'self';
    }[];
    description: string;
    wildcard_effect: string;
    art_prompt: string;
  }[];
}

export class CardGenerator {
  private llmClient: LLMClient;

  constructor(client?: LLMClient) {
    this.llmClient = client || llmClient;
  }

  /**
   * Generate a batch of cards
   */
  public async generateCards(options: CardGenerationOptions = {}): Promise<Card[]> {
    const {
      temperature = 0.7,
      count = 5,
      theme = 'fantasy',
      playerContext,
      excludedEffects = [],
      maxEnergyCost = 5
    } = options;

    // Create the prompt for card generation
    const prompt = this.createCardGenerationPrompt({
      count,
      theme,
      playerContext,
      excludedEffects,
      maxEnergyCost
    });

    // Call the LLM with the prompt
    const response = await this.llmClient.complete(prompt, {
      temperature,
      systemPrompt: this.getCardGenerationSystemPrompt(),
    });

    // Parse the response to extract cards
    const parsedCards = this.parseCardResponse(response.content);
    
    // Add IDs and metadata to the cards
    return parsedCards.map(card => ({
      ...card,
      id: uuidv4(),
      createdAt: Date.now(),
      createdBy: 'llm'
    }));
  }

  /**
   * Create the system prompt for card generation
   */
  private getCardGenerationSystemPrompt(): string {
    return `You are a creative card game designer. Your specialty is creating balanced yet interesting cards for a fantasy card battle game. 
    
Each card should have:
1. A fantasy-themed name
2. An energy cost (1-5)
3. Base effects that are clear and specific (damage, block, draw, etc.)
4. A wildcard effect that adds a unique twist but remains balanced
5. A brief art prompt describing the card's visual appearance

All responses must be in valid JSON format.`;
  }

  /**
   * Create the user prompt for card generation
   */
  private createCardGenerationPrompt(options: {
    count: number;
    theme: string;
    playerContext?: PlayerContext;
    excludedEffects?: string[];
    maxEnergyCost: number;
  }): string {
    const { count, theme, playerContext, excludedEffects = [], maxEnergyCost } = options;

    let prompt = `Generate ${count} unique cards for a fantasy card battle game with the theme: ${theme}.

The game has these mechanics:
- Players have HP (starting at 80)
- Players can gain Block which absorbs damage
- Players have Energy (5 per turn) to play cards
- Cards can target either the player or the opponent

For each card, provide:
1. Name: A thematic fantasy name
2. Cost: Energy cost from 1 to ${maxEnergyCost}
3. Base Effects: Specific numerical effects (damage, block, draw, etc.)
4. Description: A short flavor text
5. Wildcard Effect: A unique twist that's creative but balanced
6. Art Prompt: A brief visual description for the card

Guidelines:
- Each card should be unique and fit the theme
- Base effects should be clear and specific (e.g., "Deal 8 damage", "Gain 5 block")
- Wildcard effects should add a unique twist but remain balanced
- Most cards should cost 1-3 energy, with a few powerful 4-5 energy cards
- Balance the distribution of offensive and defensive cards`;

    // Add context about the current game state if available
    if (playerContext) {
      prompt += `\n\nCurrent player state:
- HP: ${playerContext.hp}/${playerContext.maxHp}
- Block: ${playerContext.block}
- Energy: ${playerContext.energy}`;

      if (playerContext.statusEffects && playerContext.statusEffects.length > 0) {
        prompt += `\n- Status Effects: ${playerContext.statusEffects.map(effect => 
          `${effect.name} (${effect.description}, ${effect.duration} turns)`
        ).join(', ')}`;
      }

      // Add suggestions based on player state
      if (playerContext.hp < playerContext.maxHp * 0.3) {
        prompt += `\n\nThe player is low on health. Consider generating some healing or defensive cards.`;
      } else if (playerContext.hp > playerContext.maxHp * 0.7) {
        prompt += `\n\nThe player has plenty of health. Feel free to include some risk/reward cards.`;
      }
    }

    // Add excluded effects if any
    if (excludedEffects.length > 0) {
      prompt += `\n\nPlease avoid these effect types in this batch: ${excludedEffects.join(', ')}.`;
    }

    // Request structured format for easier parsing
    prompt += `\n\nRespond with a valid JSON object containing an array of cards. Example format:
{
  "cards": [
    {
      "name": "Frost Nova",
      "cost": 2,
      "base_effects": [
        {
          "effect_type": "damage",
          "value": 6,
          "target": "opponent"
        },
        {
          "effect_type": "block",
          "value": 3,
          "target": "self"
        }
      ],
      "description": "The fury of winter in your hands.",
      "wildcard_effect": "If the opponent has no Block, apply 1 Frozen status.",
      "art_prompt": "A swirling blue crystal emitting frost particles and icy mist."
    },
    ...more cards...
  ]
}`;

    return prompt;
  }

  /**
   * Parse the LLM response to extract cards
   */
  private parseCardResponse(content: string): Card[] {
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in the response');
      }

      const jsonContent = jsonMatch[0];
      const parsed = JSON.parse(jsonContent) as RawCardResponse;

      if (!parsed.cards || !Array.isArray(parsed.cards)) {
        throw new Error('Invalid response format: cards array not found');
      }

      // Transform the raw cards into our Card interface
      return parsed.cards.map(card => ({
        id: '', // Will be filled in by the caller
        name: card.name,
        cost: Math.max(0, Math.min(5, card.cost)), // Ensure cost is within valid range
        base_effects: card.base_effects.map(effect => ({
          effect_type: effect.effect_type,
          value: effect.value,
          target: effect.target
        })),
        description: card.description,
        wildcard_effect: card.wildcard_effect,
        art_prompt: card.art_prompt,
        createdAt: 0, // Will be filled in by the caller
        createdBy: '' // Will be filled in by the caller
      }));
    } catch (error) {
      console.error('Failed to parse card response:', error);
      console.log('Raw response:', content);
      throw new Error(`Failed to parse card response: ${(error as Error).message}`);
    }
  }
}

// Export a lazy-loaded singleton instance for convenience
export const cardGenerator = (() => {
  let instance: CardGenerator | null = null;
  return () => {
    if (!instance) {
      instance = new CardGenerator();
    }
    return instance;
  };
})()();