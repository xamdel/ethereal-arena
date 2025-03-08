import { Card } from '@/types';
import { LLMClient, llmClient } from './api-client';

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
        timing?: 'turn-start' | 'turn-end' | 'on-attack' | 'on-damaged';
      }[];
    };
  };
  activePlayerId: string;
  turn: number;
  phase: string;
}

interface CardPlayContext {
  card: Card;
  playerId: string;
  targetId?: string;
  gameState: GameState;
}

export type StateChangeAction = {
  action: 'REMOVE_HP' | 'ADD_HP' | 'ADD_BLOCK' | 'REMOVE_BLOCK' | 
          'ADD_ENERGY' | 'REMOVE_ENERGY' | 'ADD_STATUS_EFFECT' | 
          'REMOVE_STATUS_EFFECT' | 'MODIFY_STATUS_EFFECT' |
          'DRAW' | 'DISCARD';
  target: 'self' | 'opponent';
  value: number;
  statusId?: string;
  statusName?: string;
  statusDescription?: string;
  duration?: number;
  timing?: 'immediate' | 'turn-start' | 'turn-end' | 'on-attack' | 'on-damaged';
  reasoning: string;
};

interface CardInterpretationResponse {
  narrative: string;
  stateChanges: StateChangeAction[];
}

interface CostCacheEntry {
  gameStateHash: string; // Hash of relevant game state
  cardId: string;
  playerId: string;
  result: {
    canPlay: boolean;
    energyCost: number;
    reason: string;
  };
  timestamp: number;
}

export class EffectInterpreter {
  private llmClient: LLMClient;
  private costCache: CostCacheEntry[] = [];
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds TTL for cache entries
  private readonly MAX_CACHE_SIZE = 50; // Maximum number of cache entries

  constructor(client?: LLMClient) {
    this.llmClient = client || llmClient;
  }
  
  /**
   * Generate a simple hash of the game state parts relevant to card costs
   */
  private getGameStateHash(context: CardPlayContext): string {
    const { playerId, gameState } = context;
    const player = gameState.players[playerId];
    
    // Only include state that affects energy costs
    const relevantState = {
      playerId,
      energy: player.energy,
      statusEffects: player.statusEffects.map(effect => ({
        name: effect.name,
        description: effect.description
      }))
    };
    
    return JSON.stringify(relevantState);
  }
  
  /**
   * Clear cache entries for a specific player/game when game state changes
   */
  public clearCostCacheForPlayer(playerId: string): void {
    this.costCache = this.costCache.filter(entry => entry.playerId !== playerId);
    console.log(`[EffectInterpreter] Cleared cost cache for player ${playerId}`);
  }
  
  /**
   * Clear expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const oldSize = this.costCache.length;
    
    // Remove expired entries
    this.costCache = this.costCache.filter(
      entry => (now - entry.timestamp) < this.CACHE_TTL
    );
    
    // If still too large, remove oldest entries
    if (this.costCache.length > this.MAX_CACHE_SIZE) {
      this.costCache.sort((a, b) => a.timestamp - b.timestamp);
      this.costCache = this.costCache.slice(this.costCache.length - this.MAX_CACHE_SIZE);
    }
    
    if (oldSize !== this.costCache.length) {
      console.log(`[EffectInterpreter] Cleaned up cache: ${oldSize} → ${this.costCache.length} entries`);
    }
  }

  public async interpretCardEffects(context: CardPlayContext): Promise<{
    stateChanges: StateChangeAction[];
    narrative: string;
    canPlayCard: boolean;
  }> {
    // Step 1: Check if the player can play the card based on cost vs available energy
    const canPlay = await this.checkIfPlayerCanPlayCard(context);
    
    if (!canPlay) {
      return {
        stateChanges: [],
        narrative: "Not enough energy to play this card.",
        canPlayCard: false
      };
    }

    // Step 2: If player can play the card, interpret the effects
    const prompt = this.createEffectInterpretationPrompt(context);
    const response = await this.llmClient.complete(prompt, {
      temperature: 0.3,
      systemPrompt: this.getEffectInterpretationSystemPrompt(),
    });

    const interpretation = this.parseEffectInterpretation(response.content);

    return {
      stateChanges: interpretation.stateChanges,
      narrative: interpretation.narrative,
      canPlayCard: true
    };
  }
  
  /**
   * Calculate the energy cost of playing a card and determine if it can be played
   */
  public async calculateCardEnergyCost(context: CardPlayContext): Promise<{
    canPlay: boolean;
    energyCost: number;
    reason: string;
    fromCache?: boolean;
  }> {
    const { card, playerId, gameState } = context;
    const player = gameState.players[playerId];
    
    // Clean up old cache entries
    this.cleanupCache();
    
    // Check if we have a cached result for this card/state
    const stateHash = this.getGameStateHash(context);
    const cachedResult = this.costCache.find(entry => 
      entry.cardId === card.id && 
      entry.playerId === playerId && 
      entry.gameStateHash === stateHash
    );
    
    if (cachedResult) {
      console.log(`[EffectInterpreter] Using cached cost calculation for card ${card.name}`);
      // Return the cached result with a flag indicating it came from cache
      return { 
        ...cachedResult.result,
        fromCache: true 
      };
    }
    
    // If not in cache, calculate the cost
    console.log(`[EffectInterpreter] Calculating cost for card ${card.name}`);
    
    // Create a minimal prompt to calculate energy cost
    const prompt = `
Calculate the exact energy cost for this card in the current context:

CARD:
- Name: ${card.name}
- Base Cost: ${card.cost}
- Description: ${card.description}
- Effects: ${JSON.stringify(card.base_effects)}
- Special Effects: ${card.wildcard_effect || 'None'}

PLAYER:
- Available Energy: ${player.energy}
- Status Effects: ${player.statusEffects.length > 0 ? 
  player.statusEffects.map(effect => 
    `${effect.name} (${effect.description})`
  ).join(', ') : 'None'}

Consider:
1. The card's base cost
2. Any status effects that might reduce or increase card costs
3. Any special card effects that might reduce its own cost

Response format:
{
  "energy_cost": number,  // The final calculated energy cost
  "can_play": boolean,    // Whether player has enough energy to play
  "reason": "string"      // Brief explanation of any cost modifications
}
`;

    try {
      const response = await this.llmClient.complete(prompt, {
        temperature: 0.1,
        systemPrompt: `You are a card game rules engine that calculates energy costs. Respond with only valid, concise JSON.`,
        maxTokens: 150, // Small but enough for the JSON response
      });

      // Parse the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`[EffectInterpreter] Invalid cost calculation response format: ${response.content}`);
        const result = { 
          canPlay: false, 
          energyCost: card.cost, 
          reason: "Error calculating energy cost, using base cost" 
        };
        return result;
      }

      const jsonContent = jsonMatch[0];
      const parsed = JSON.parse(jsonContent);
      
      const energyCost = parsed.energy_cost !== undefined ? Number(parsed.energy_cost) : card.cost;
      const canPlay = parsed.can_play !== undefined ? Boolean(parsed.can_play) : (player.energy >= energyCost);
      const reason = parsed.reason || `Base cost: ${card.cost}`;

      console.log(`[EffectInterpreter] Card ${card.name} costs ${energyCost} energy (${canPlay ? 'can play' : 'cannot play'}): ${reason}`);
      
      // Create the result
      const result = { canPlay, energyCost, reason };
      
      // Cache the result
      this.costCache.push({
        gameStateHash: stateHash,
        cardId: card.id,
        playerId,
        result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error(`[EffectInterpreter] Error in cost calculation: ${(error as Error).message}`);
      const result = { 
        canPlay: player.energy >= card.cost, 
        energyCost: card.cost, 
        reason: "Error calculating energy cost, using base cost" 
      };
      return result;
    }
  }
  
  /**
   * Check if the player can play a card (for backward compatibility)
   */
  private async checkIfPlayerCanPlayCard(context: CardPlayContext): Promise<boolean> {
    const result = await this.calculateCardEnergyCost(context);
    return result.canPlay;
  }

  private getEffectInterpretationSystemPrompt(): string {
    return `You are a card game interpreter that translates card effects into specific game actions. 
    
Your role is to:
1. Interpret card effects within the current game context
2. Translate effects into specific state change actions
3. Ensure all interpretations are balanced and fair
4. Provide a narrative description of what happens when the card is played

Consider all relevant status effects when determining outcomes.
All responses must be in valid JSON format.`;
  }

  private createEffectInterpretationPrompt(context: CardPlayContext): string {
    const { card, playerId, targetId, gameState } = context;
    const player = gameState.players[playerId];
    const opponent = Object.values(gameState.players).find(p => p.id !== playerId);
    
    const opponentId = opponent?.id || 'no-opponent';

    let prompt = `Interpret the effects of the following card in the current game context:

CARD DETAILS:
- Name: ${card.name}
- Description: ${card.description}
- Base effects: ${card.base_effects}
- Special effects: ${card.wildcard_effect}

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
        `${effect.name} (ID: ${effect.id}, ${effect.description}, ${effect.duration} turns${effect.timing ? `, triggers: ${effect.timing}` : ''})`
      ).join(', ') : 'None'}

OPPONENT:
- HP: ${opponent?.hp}/${opponent?.maxHp}
- Block: ${opponent?.block}
- Status effects: ${opponent?.statusEffects && opponent.statusEffects.length > 0 ? 
      opponent.statusEffects.map(effect => 
        `${effect.name} (ID: ${effect.id}, ${effect.description}, ${effect.duration} turns${effect.timing ? `, triggers: ${effect.timing}` : ''})`
      ).join(', ') : 'None'}`;

    if (targetId) {
      prompt += `\n\nSPECIFIC TARGET: ${targetId === playerId ? 'self' : 'opponent'}`;
    }

    prompt += `\n\nPOSSIBLE STATE CHANGE ACTIONS (with schema examples):

// Health and Block changes
{
  "action": "REMOVE_HP",   // or "ADD_HP"
  "target": "opponent",    // or "self"
  "value": 7,              // amount of HP to remove/add
  "reasoning": "5 base damage + 2 from Vulnerable status effect"
}

{
  "action": "ADD_BLOCK",   // or "REMOVE_BLOCK"
  "target": "self",        // or "opponent"
  "value": 5,              // amount of block to add/remove
  "reasoning": "Defensive stance provides 5 block"
}

// Energy management
{
  "action": "ADD_ENERGY",  // or "REMOVE_ENERGY"
  "target": "self",        // always "self" for energy
  "value": 1,              // amount of energy to add/remove
  "reasoning": "Status effect grants 1 energy when healing"
}

// Card manipulation
{
  "action": "DRAW",        // or "DISCARD"
  "target": "self",        // usually "self" for card actions
  "value": 2,              // number of cards to draw/discard
  "reasoning": "Card effect allows drawing 2 additional cards"
}

// Status effect management
{
  "action": "ADD_STATUS_EFFECT",
  "target": "opponent",    // or "self"
  "statusName": "Burning", // name of the status
  "statusDescription": "Target takes 3 damage at the start of each turn",
  "duration": 2,           // number of turns the effect lasts
  "timing": "turn-start",  // when the effect triggers
  "value": 3,              // value associated with the effect (e.g. damage amount)
  "reasoning": "Flames ignite the target, causing ongoing damage"
}

{
  "action": "REMOVE_STATUS_EFFECT",
  "target": "self",        // or "opponent"
  "statusName": "Poison",  // name of the status to remove
  "reasoning": "Antidote removes all poison"
}

{
  "action": "MODIFY_STATUS_EFFECT",
  "target": "opponent",    // or "self" 
  "statusName": "Burning", // name of the status to modify
  "value": 5,              // new value
  "duration": 3,           // new duration (optional)
  "reasoning": "Oil increases burning damage and extends duration"
}

Your task:
1. Interpret the card effect(s) in the context of the current game state
2. Consider how any status effects might modify the outcome
3. Translate the card effect into specific state change actions
4. Provide a narrative description of what happens

Rules for interpretation:
- Interpret card effects fairly and consistently
- Provide a state change action for ALL effects
- Provide a "reasoning" field to explain each state change
- For status effects, specify duration
- For status effect timing, use: immediate, turn-start, turn-end, on-attack, on-damaged
- For targets, always use either "self" (for the player using the card) or "opponent"

Respond with a JSON object containing a narrative and state changes. Here are complete examples:

EXAMPLE 1 - Basic attack vs block:
{
  "narrative": "Your sword slams into the opponent's shield, shattering their defenses before cutting into their armor.",
  "stateChanges": [
    {
      "action": "REMOVE_BLOCK",
      "target": "opponent",
      "value": 5,
      "reasoning": "Sword attack removes all remaining block"
    },
    {
      "action": "REMOVE_HP",
      "target": "opponent",
      "value": 3,
      "reasoning": "Attack does 8 total damage, 5 was absorbed by block, 3 damages HP"
    }
  ]
}

EXAMPLE 2 - Status effect interaction:
{
  "narrative": "A bolt of lightning arcs from your fingertips, intensified by the conductive water soaking your opponent.",
  "stateChanges": [
    {
      "action": "REMOVE_HP",
      "target": "opponent",
      "value": 12,
      "reasoning": "8 base damage + 50% bonus (4) from Soaked status effect"
    },
    {
      "action": "REMOVE_STATUS_EFFECT",
      "target": "opponent",
      "statusName": "Soaked",
      "reasoning": "Lightning evaporates the water, removing Soaked status"
    },
    {
      "action": "ADD_STATUS_EFFECT",
      "target": "opponent",
      "statusName": "Stunned",
      "statusDescription": "Skip next action due to electrical shock",
      "duration": 1,
      "timing": "immediate",
      "reasoning": "Lightning temporarily paralyzes the target"
    }
  ]
}
  
IMPORTANT: Make sure to include a state change action for EVERY card effect, both base and special`;

    return prompt;
  }

  private parseEffectInterpretation(content: string): CardInterpretationResponse {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in the response');
      }

      const jsonContent = jsonMatch[0];
      const parsed = JSON.parse(jsonContent);

      if (!parsed.narrative) {
        throw new Error('Invalid response format: narrative string not found');
      }
      
      if (typeof parsed.narrative !== 'string') {
        throw new Error('Invalid response format: narrative is not a string');
      }

      if (!parsed.stateChanges) {
        throw new Error('Invalid response format: stateChanges array not found');
      }
      
      if (!Array.isArray(parsed.stateChanges)) {
        throw new Error('Invalid response format: stateChanges is not an array');
      }

      // Validate each state change
      parsed.stateChanges.forEach((change: any, index: number) => {
        if (!change.action) {
          throw new Error(`State change at index ${index} missing required 'action' field`);
        }
        if (!change.target) {
          throw new Error(`State change at index ${index} missing required 'target' field`);
        }
        if (change.value === undefined && 
            !['REMOVE_STATUS_EFFECT', 'MODIFY_STATUS_EFFECT'].includes(change.action)) {
          throw new Error(`State change at index ${index} missing required 'value' field`);
        }
        if (['REMOVE_STATUS_EFFECT', 'MODIFY_STATUS_EFFECT'].includes(change.action) && !change.statusName) {
          throw new Error(`Status effect change at index ${index} missing required 'statusName' field`);
        }
        if (change.action === 'ADD_STATUS_EFFECT' && !change.statusName) {
          throw new Error(`ADD_STATUS_EFFECT at index ${index} missing required 'statusName' field`);
        }
        if (change.action === 'ADD_STATUS_EFFECT' && !change.statusDescription) {
          throw new Error(`ADD_STATUS_EFFECT at index ${index} missing required 'statusDescription' field`);
        }
        if (change.action === 'ADD_STATUS_EFFECT' && !change.duration) {
          throw new Error(`ADD_STATUS_EFFECT at index ${index} missing required 'duration' field`);
        }
        if (!change.reasoning) {
          throw new Error(`State change at index ${index} missing required 'reasoning' field`);
        }
      });

      return {
        stateChanges: parsed.stateChanges,
        narrative: parsed.narrative
      };
    } catch (error) {
      throw new Error(`Failed to parse effect interpretation: ${(error as Error).message}`);
    }
  }
}

export const effectInterpreter = (() => {
  let instance: EffectInterpreter | null = null;
  return () => {
    if (!instance) {
      instance = new EffectInterpreter();
    }
    return instance;
  };
})();