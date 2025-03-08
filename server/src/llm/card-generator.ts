import { v4 as uuidv4 } from 'uuid';
import { LLMClient, llmClient } from './api-client';
import { Card } from '@/types';

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
    base_effects: string;
    description: string;
    wildcard_effect?: string;
    art_prompt: string;
    flavor_text?: string;
    on_play_description?: string;
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
3. Base effects that are clear and specific (e.g. Deal damage, Gain block)
4. A wildcard effect that adds a unique twist but remains balanced (optional)
5. A brief art prompt describing the card's visual appearance

Card balance should be roughly 5 points of damage/block/healing per 1 point of energy, but wildcard effects should be taken into consideration, i.e. a 3-cost card should not both deal 15 damage AND have a powerful wildcard effect.

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
3. Base Effects: A string describing the card's primary effects
4. Description: A short flavor text describing the card
5. Wildcard Effect: A unique twist that's creative but balanced (optional)
6. Art Prompt: A brief visual description for the card
7. On Play Description: A string describing what happens when the player begins playing the card
8. Flavor Text: An additional short flavor text (optional - don't include every time)

Guidelines:
- Each card should be unique and fit the theme
- Base effects should be clear and specific (e.g., "Deal 5 damage", "Gain 5 block")
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
      "name": "Arcane Bolt",
      "cost": 1,
      "base_effects": "Deal 5 damage to the opponent",
      "description": "A simple but effective spell.",
      "wildcard_effect": "If the opponent has less than 20 HP, deal 10 damage instead.",
      "art_prompt": "A glowing blue bolt of energy hurtling towards the opponent.",
      "on_play_description": "[player] gestures, and a bolt of arcane energy streaks towards [opponent].",
      "flavor_text": "Magic is not always about complexity, sometimes simplicity is key."
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
        base_effects: card.base_effects,
        description: card.description,
        wildcard_effect: card.wildcard_effect,
        art_prompt: card.art_prompt,
        flavor_text: card.flavor_text,
        on_play_description: card.on_play_description,
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
