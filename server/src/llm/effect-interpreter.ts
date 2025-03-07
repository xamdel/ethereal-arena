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

export class EffectInterpreter {
  private llmClient: LLMClient;

  constructor(client?: LLMClient) {
    this.llmClient = client || llmClient;
  }

  public async interpretCardEffects(context: CardPlayContext): Promise<{
    stateChanges: StateChangeAction[];
    narrative: string;
  }> {
    const prompt = this.createEffectInterpretationPrompt(context);
    const response = await this.llmClient.complete(prompt, {
      temperature: 0.3,
      systemPrompt: this.getEffectInterpretationSystemPrompt(),
    });

    const interpretation = this.parseEffectInterpretation(response.content);

    return {
      stateChanges: interpretation.stateChanges,
      narrative: interpretation.narrative
    };
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
- Cost: ${card.cost}
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
  "target": "self",        // usually "self" for energy
  "value": 2,              // amount of energy to add/remove
  "reasoning": "Card cost (reduced from 3 due to Focus status)"
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
1. Interpret the card effect in the context of the current game state
2. Consider how any status effects might modify the outcome
3. Translate the card effect into specific state change actions
4. Provide a narrative description of what happens

Rules for interpretation:
- Interpret card effects fairly and consistently
- Provide a "reasoning" field to explain each state change
- For status effects, specify duration (typically 2-3 turns)
- For status effect timing, use: immediate, turn-start, turn-end, on-attack, on-damaged
- For targets, always use either "self" (for the player using the card) or "opponent"

Respond with a JSON object containing a narrative and state changes. Here are complete examples:

EXAMPLE 1 - Basic attack vs block:
{
  "narrative": "Your sword slams into the opponent's shield, shattering their defenses before cutting into their armor.",
  "stateChanges": [
    {
      "action": "REMOVE_ENERGY",
      "target": "self",
      "value": 2,
      "reasoning": "Card cost"
    },
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
      "action": "REMOVE_ENERGY",
      "target": "self",
      "value": 1,
      "reasoning": "Card cost reduced from 2 to 1 by Focused status"
    },
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
}`;

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