import React, { useEffect, useRef, useState } from "react";
import { GameState, GameStateContext, initialPlayerState } from ".";
import { Buff, Card, CombatLogEntry, Debuff, Player, PlayerState } from "../models";
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
    const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
    const [playerReady, setPlayerReady] = useState({ player1: false, player2: false });

    const handlePlayerReady = (player: 'player1' | 'player2') => {
        setPlayerReady(prev => ({ ...prev, [player]: true }));
    };

    // Randomly choose starting player and generate initial hand when both players click ready
    useEffect(() => {
        if (playerReady.player1 && playerReady.player2) {
            addCombatLogEntry('System', 'Both players ready. Starting match...')
            addCombatLogEntry('System', 'Rolling for first turn...')

            const startingPlayer = Math.random() < 0.5 ? 'player1' : 'player2';
            addCombatLogEntry('System', `${startingPlayer} goes first. Generating starting hand...`)

            generateHand().then(hand => {
                setGameState(prev => ({
                    ...prev,
                    turn: startingPlayer,
                    [startingPlayer]: { ...prev[startingPlayer], hand },
                }));
            });
        }
    }, [playerReady]);

    const endTurn = () => {
        setGameState(prev => {
            addCombatLogEntry('System', `${prev.turn} ended their turn.`)
            const nextPlayer = prev.turn === 'player1' ? 'player2' : 'player1';

            return {
                ...prev,
                turn: nextPlayer,
                turnNumber: prev.turnNumber + 1,
            };
        });
    };

    const addCombatLogEntry = (category: 'System' | 'Player Action', details: string | object, player?: 'player1' | 'player2') => {
        const timestamp = new Date();
        const entry: CombatLogEntry = { timestamp, category, details, player };
      
        setCombatLog(prev => [...prev, entry]);
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

    const onCardDrop = (card: Card) => {
        //TODO: Call game logic interpreter
        addCombatLogEntry('Player Action', `Player ${gameState.turn} played ${card.name}`);
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

    const [gameState, setGameState] = useState<GameState>({
        player1: initialPlayerState,
        player2: initialPlayerState,
        turn: undefined,
        turnNumber: 1,
        combatLog,
        addCombatLogEntry,
        handlePlayerReady,
        endTurn,
        addCardToHand,
        removeCardFromHand,
        onCardDrop
    });

    // Generate hand for other player when current player ends turn
    useEffect(() => {
        if (gameState.turnNumber === 1) return;

        addCombatLogEntry('System', `Generating cards...`)

        const generateNewHand = async () => {
            try {
                const newHand = await generateHand();
                setGameState(prev => ({
                    ...prev,
                    [gameState.turn as 'player1' | 'player2']: {
                        ...prev[gameState.turn as 'player1' | 'player2'],
                        hand: newHand,
                    }
                }));
            } catch (error) {
                console.error("Error generating new hand:", error);
            }
        };

        generateNewHand();
    }, [gameState.turn]);

    return (
        <GameStateContext.Provider value={{ ...gameState, combatLog, addCardToHand, removeCardFromHand, onCardDrop }}>
            {children}
        </GameStateContext.Provider>
    )
}