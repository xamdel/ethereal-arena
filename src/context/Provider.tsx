import React, { useEffect, useState } from "react";
import { GameState, GameStateContext, initialPlayerState } from ".";
import { Buff, Card, Debuff, Player, PlayerState } from "../models";
import { generateHand } from "../utils";

interface GameStateProviderProps {
    children: React.ReactNode;
}

// Custom hook for consuming game state context
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

    const [playerReady, setPlayerReady] = useState({ player1: false, player2: false });

    const handlePlayerReady = (player: 'player1' | 'player2') => {
        setPlayerReady(prev => ({ ...prev, [player]: true }));
    };

    // Generate intial hands when both players click ready
    useEffect(() => {
        if (playerReady.player1 && playerReady.player2) {
          Promise.all([generateHand(), generateHand()]).then(([hand1, hand2]) => {
            setGameState(prev => ({
              ...prev,
              player1: { ...prev.player1, hand: hand1 },
              player2: { ...prev.player2, hand: hand2 },
            }));
          });
        }
      }, [playerReady]);

    const endTurn = async () => {
        const nextPlayer = gameState.turn === 'player1' ? 'player2' : 'player1';

        const newHand = await generateHand();

        setGameState((prev) => ({
            ...prev,
            turn: nextPlayer,
            [nextPlayer]: {
                ...prev[nextPlayer],
                hand: newHand,
            }
        }));
    };

    // HOF for updating aspects of player state
    const updatePlayerState = (player: 'player1' | 'player2', updates: Partial<PlayerState>) => {
        setGameState((prev) => ({
            ...prev,
            [player]: { ...prev[player], ...updates },
        }));
    };

    const addCardToHand = (player: 'player1' | 'player2', card: Card) => {
        updatePlayerState(player, {
            hand: [...gameState[player].hand, card],
        });
    };
    
    const removeCardFromHand = (player: 'player1' | 'player2', cardIndex: number) => {
        updatePlayerState(player, {
            hand: gameState[player].hand.filter((_, index) => index !== cardIndex),
        });
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
            <button onClick={() => handlePlayerReady('player1')}>Player 1 Ready</button>
            <button onClick={() => handlePlayerReady('player2')}>Player 2 Ready</button>
        </GameStateContext.Provider>
    )
}