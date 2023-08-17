import React from "react";
import { Health, Energy, Buff, Debuff, PlayerState, Hand, Card, Player, CombatLogEntry } from "../models";

// Define game state type
export interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  turn?: 'player1' | 'player2';
  turnNumber: number;
  combatLog: CombatLogEntry[];
  addCombatLogEntry: (category: 'System' | 'Player Action', details: string | object, player?: 'player1' | 'player2') => void;
  endTurn: () => void;
  handlePlayerReady: (player: 'player1' | 'player2') => void;
  addCardToHand?: (player: Player, card: Card) => void;
  removeCardFromHand?: (player: Player, cardIndex: number) => void;
  onCardDrop: (card: Card) => void;
}

// Define initial values for players
const initialHealth: Health = {
  current: 50,
  max: 50,
};

const initialEnergy: Energy = {
  current: 5,
  max: 5,
};

const initialBuffs: Buff[] = [];

const initialDebuffs: Debuff[] = [];

const initialHand: Hand = [];

export const initialPlayerState: PlayerState = {
  health: initialHealth,
  energy: initialEnergy,
  buffs: initialBuffs,
  debuffs: initialDebuffs,
  hand: initialHand
};

// Create the game state context
export const GameStateContext = React.createContext<GameState | undefined>(undefined);