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