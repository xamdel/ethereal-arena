import React from "react";
import { Health, Energy, Buff, Debuff } from "../models";

// Define initial health values for players
const initialHealth: Health = {
    current: 50,
    max: 50,
}

// Create the game state context
export const GameStateContext = React.createContext({
    health: initialHealth,
})