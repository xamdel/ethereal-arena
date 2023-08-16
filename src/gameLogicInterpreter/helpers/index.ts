import { GameState } from "../../context";

// Construct reader-friendly JSON of current select game state properties to be added to Game Logic Interpreter prompt
export const constructGameStateJSON = (gameState: GameState): object => {
  const player1Status = {
    currentHealth: gameState.player1.health.current,
    maxHealth: gameState.player1.health.max,
    energy: gameState.player1.energy,
    buffs: gameState.player1.buffs,
    debuffs: gameState.player1.debuffs,
  };

  const player2Status = {
    currentHealth: gameState.player2.health.current,
    maxHealth: gameState.player2.health.max,
    energy: gameState.player2.energy,
    buffs: gameState.player2.buffs,
    debuffs: gameState.player2.debuffs,
  };

  const gameStateJSON = {
    turn: gameState.turn,
    turnNumber: gameState.turnNumber,
    player1: player1Status,
    player2: player2Status,
  };

  return gameStateJSON;
};