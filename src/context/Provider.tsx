import React, { useState } from "react";
import { GameState, GameStateContext, initialPlayerState } from ".";
import { Buff, Card, Debuff, Player, PlayerState } from "../models";

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

    const updatePlayerState = (player: 'player1' | 'player2', updates: Partial<PlayerState>) => {
        setGameState((prev) => ({
            ...prev,
            [player]: { ...prev[player], ...updates },
        }));
    };

    const endTurn = () => {
        setGameState((prev) => ({
            ...prev,
            turn: prev.turn === 'player1' ? 'player2' : 'player1',
        }));
    };

    const addCardToHand = (player: Player, card: Card) => {
        setGameState((prev) => ({
            ...prev,
            [player]: { ...prev[player], hand: [...prev[player].hand, card] },
        }));
    };

    const removeCardFromHand = (player: Player, cardIndex: number) => {
        setGameState((prev) => ({
            ...prev,
            [player]: { ...prev[player], hand: prev[player].hand.filter((_, index) => index !== cardIndex) },
        }));
    };

    const addHealth = (player: 'player1' | 'player2', amount: number) => {
        updatePlayerState(player, { health: { ...gameState[player].health, current: gameState[player].health.current + amount } });
    };

    const removeHealth = (player: 'player1' | 'player2', amount: number) => {
        addHealth(player, -amount);
    };

    const addEnergy = (player: 'player1' | 'player2', amount: number) => {
        updatePlayerState(player, { energy: { ...gameState[player].energy, current: gameState[player].energy.current + amount } });
    };

    const removeEnergy = (player: 'player1' | 'player2', amount: number) => {
        addEnergy(player, -amount);
    };

    const addBuff = (player: 'player1' | 'player2', buff: Buff) => {
        updatePlayerState(player, { buffs: [...gameState[player].buffs, buff] });
    };

    const removeBuff = (player: 'player1' | 'player2', buffIndex: number) => {
        updatePlayerState(player, { buffs: gameState[player].buffs.filter((_, index) => index !== buffIndex) });
    };

    const addDebuff = (player: 'player1' | 'player2', debuff: Debuff) => {
        updatePlayerState(player, { debuffs: [...gameState[player].debuffs, debuff] });
    };

    const removeDebuff = (player: 'player1' | 'player2', debuffIndex: number) => {
        updatePlayerState(player, { debuffs: gameState[player].debuffs.filter((_, index) => index !== debuffIndex) });
    };

    return (
        <GameStateContext.Provider value={{ ...gameState, addCardToHand, removeCardFromHand }}>
            {children}
            <p>${gameState.turn}</p>
            <button onClick={endTurn}>End Turn</button>
        </GameStateContext.Provider>
    )
}