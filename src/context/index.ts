import React from "react";
import { Health, Energy, Buff, Debuff, PlayerState } from "../models";

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

const initialPlayerState: PlayerState = {
  health: initialHealth,
  energy: initialEnergy,
  buffs: initialBuffs,
  debuffs: initialDebuffs,
};

// Create the game state context
export const GameStateContext = React.createContext({
  player1: initialPlayerState,
  player2: initialPlayerState,
});