import { useState } from "react";
import { GameState, GameStateContext, initialPlayerState } from ".";

interface GameStateProviderProps {
    children: React.ReactNode;
  }

export const GameStateProvider: React.FC<GameStateProviderProps> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>({
      player1: initialPlayerState,
      player2: initialPlayerState,
    });
  
    return (
      <GameStateContext.Provider value={gameState}>
        {children}
      </GameStateContext.Provider>
    )
  }