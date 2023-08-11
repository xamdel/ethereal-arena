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
}

export interface Card {
  name: string;
  effect: string;
  energyCost: string;
}