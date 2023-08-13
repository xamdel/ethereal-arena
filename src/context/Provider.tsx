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
  
    const endTurn = () => {
        setGameState((prev) => ({
          ...prev,
          turn: prev.turn === 'player1' ? 'player2' : 'player1',
        }));
      };


    return (
      <GameStateContext.Provider value={gameState}>
        {children}
        <p>${gameState.turn}</p>
        <button onClick={endTurn}>End Turn</button>
      </GameStateContext.Provider>
    )
  }