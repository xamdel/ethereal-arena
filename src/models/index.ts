export interface Health {
  current: number;
  max: number;
}

export interface Energy {
  current: number;
  max: number;
}

export interface Buff {
  type: string;
  duration: number;
  effect: string;
}

export interface Debuff {
  type: string;
  duration: number;
  effect: string;
}

export interface PlayerState {
  health: Health;
  energy: Energy;
  buffs: Buff[];
  debuffs: Debuff[];
  hand: Hand;
}

export interface Card {
  name: string;
  effect: string;
  energyCost: number;
}

export type Hand = Card[];

export type Player = 'player1' | 'player2';

export interface CombatLogEntry {
  timestamp: Date;
  category: 'System' | 'Player Action';
  player?: 'player1' | 'player2';
  details: string | object;
}