import React, { useState } from "react";
import { GameState, GameStateContext, initialPlayerState } from ".";
import { Card } from "../models";

interface GameStateProviderProps {
    children: React.ReactNode;
}

export const useGameState = () => {
    const context = React.useContext(GameStateContext);
    if (!context) {
      throw new Error('useGameState must be used within a GameStateProvider');
    }
    return context;
  };
  

export const GameStateProvider: React.FC<GameStateProviderProps> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>({
        player1: initialPlayerState,
        player2: initialPlayerState,
        turn: 'player1',
    });

    const endTurn = () => {
        setGameState((prev) => ({
            ...prev,
            turn: prev.turn === 'player1' ? 'player2' : 'player1',
        }));
    };

    const addCardToHand = (player: 'player1' | 'player2', card: Card) => {
        setGameState((prev) => ({
            ...prev,
            [player]: { ...prev[player], hand: [...prev[player].hand, card] },
        }));
    };

    const removeCardFromHand = (player: 'player1' | 'player2', cardIndex: number) => {
        setGameState((prev) => ({
            ...prev,
            [player]: { ...prev[player], hand: prev[player].hand.filter((_, index) => index !== cardIndex) },
        }));
    };

    return (
        <GameStateContext.Provider value={{ ...gameState, addCardToHand, removeCardFromHand }}>
            {children}
            <p>${gameState.turn}</p>
            <button onClick={endTurn}>End Turn</button>
        </GameStateContext.Provider>
    )
}