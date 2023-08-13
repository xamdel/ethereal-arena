import React, { useState } from "react";
import { Health, Energy, Buff, Debuff, PlayerState } from "../models";

// Define game state type
export interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  turn?: string;
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

export const initialPlayerState: PlayerState = {
  health: initialHealth,
  energy: initialEnergy,
  buffs: initialBuffs,
  debuffs: initialDebuffs,
};

// Create the game state context
export const GameStateContext = React.createContext<GameState>({
  player1: initialPlayerState,
  player2: initialPlayerState,
  turn: 'player1'
});