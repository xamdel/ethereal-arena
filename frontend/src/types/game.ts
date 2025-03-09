/**
 * Core type definitions for Ethereal Arena game
 */

/**
 * Card interface
 * Represents a playable card in the game
 */
export interface Card {
  id: string;
  name: string;
  cost: number;
  base_effects: string;
  description: string;
  wildcard_effect?: string;
  art_prompt: string;
  flavor_text?: string;
  on_play_description?: string;
  createdAt: number; // Timestamp for synchronization
  createdBy: string; // ID of LLM instance that generated this
}

/**
 * Player interface
 * Represents a player in the game
 */
export interface Player {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  maxEnergy: number;
  draw: number;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  statusEffects: StatusEffect[];
  isActive: boolean; // Whether it's this player's turn
  isAI: boolean; // Whether this player is AI-controlled
}

/**
 * GameState interface
 * Represents the complete state of a game
 */
export interface GameState {
  id: string;
  players: Record<string, Player>;
  activePlayerId: string;
  turnNumber: number;
  phase: "init" | "turnStart" | "draw" | "action" | "turnEnd";
  effectQueue: QueuedEffect[];
  actionHistory: GameAction[];
  turnStartTime: number;
  lastUpdateTime: number;
  winner: string | null;
  isMultiplayer: boolean;
  lastNarrative?: string; // Narrative description of the last card played
  cardNarrative?: string; // The overall narrative for the card played 
  effectNarrations?: string[]; // Individual narrations for each effect
}

/**
 * StatusEffect interface
 * Represents an ongoing effect applied to a player
 */
export interface StatusEffect {
  id: string;
  name: string;
  description: string;
  duration: number;
  visual?: string;
}

/**
 * QueuedEffect interface
 * Represents an effect waiting to be processed in the queue
 */
export interface QueuedEffect {
  id: string;
  type: string;
  value?: number;
  source: string;
  target: string;
  card?: string;
  timing: "immediate" | "after-damage" | "turn-start" | "turn-end";
  statusName?: string;
  statusDescription?: string;
  duration?: number;
  timestamp: number; // For ordering and replay
  actionId: string;  // ID of the action that generated this effect
  narration?: string; // Narrative description of this specific effect
}

/**
 * GameAction interface
 * Represents a player action that changes the game state
 */
export interface GameAction {
  id: string;
  type: string;
  playerId: string;
  payload: any;
  timestamp: number;
  gameId: string;
  validated: boolean; // Indicates if action has been validated by the server
  correlationId?: string; // Optional correlation ID for request/response tracking
}

/**
 * ActionTypes enum
 * Common action types used in the game
 */
export enum ActionType {
  PLAY_CARD = 'PLAY_CARD',
  END_TURN = 'END_TURN',
  SELECT_CARDS = 'SELECT_CARDS',
  APPLY_EFFECT = 'APPLY_EFFECT',
  GAME_INIT = 'GAME_INIT',
  PROCESS_QUEUE = 'PROCESS_QUEUE'
}
