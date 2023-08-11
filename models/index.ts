interface Health {
  current: number;
  max: number;
}

interface Energy {
  current: number;
  max: number;
}

interface Buff {
  type: string;
  duration: number;
  effect: string;
}

interface Debuff {
  type: string;
  duration: number;
  effect: string;
}