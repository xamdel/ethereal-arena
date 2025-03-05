'use client';

import { createContext, useContext, useReducer, ReactNode, useState, useEffect } from 'react';
import { GameState, GameAction, ActionType } from '@/types';

// Initial empty game state
const initialGameState: GameState = {
  id: '',
  players: {},
  activePlayerId: '',
  turnNumber: 0,
  phase: 'init',
  effectQueue: [],
  actionHistory: [],
  turnStartTime: 0,
  lastUpdateTime: 0,
  winner: null,
  isMultiplayer: false
};

// Separate UI state from core game state
interface UIState {
  selectedCardId: string | null;
  targetPlayerId: string | null;
  isProcessing: boolean;
  errorMessage: string | null;
  showCardDetail: string | null;
  isConnected: boolean;
  lastSyncTime: number;
}

const initialUIState: UIState = {
  selectedCardId: null,
  targetPlayerId: null,
  isProcessing: false,
  errorMessage: null,
  showCardDetail: null,
  isConnected: false,
  lastSyncTime: 0
};

// Create reducer for core game state
function gameStateReducer(state: GameState, action: GameAction): GameState {
  // This is a placeholder for the full implementation
  // In a complete implementation, this would handle all game state transitions
  
  switch (action.type) {
    case ActionType.GAME_INIT:
      return {
        ...action.payload,
        lastUpdateTime: Date.now()
      };
    
    case ActionType.PLAY_CARD:
      // For UI testing, we'll implement some basic logic
      const { cardId, targetPlayerId } = action.payload;
      const activePlayer = state.players[state.activePlayerId];
      
      // Find the card in the player's hand
      const cardIndex = activePlayer.hand.findIndex(card => card.id === cardId);
      if (cardIndex === -1) return state; // Card not found
      
      const card = activePlayer.hand[cardIndex];
      
      // Check if player has enough energy
      if (activePlayer.energy < card.cost) return state;
      
      // Remove the card from hand and add to discard
      const updatedHand = [...activePlayer.hand];
      const removedCard = updatedHand.splice(cardIndex, 1)[0];
      
      const updatedPlayers = {
        ...state.players,
        [state.activePlayerId]: {
          ...activePlayer,
          hand: updatedHand,
          discard: [...activePlayer.discard, removedCard],
          energy: activePlayer.energy - card.cost
        }
      };
      
      // For testing, we'll add a simple effect to the queue
      const effectType = card.base_effects[0]?.effect_type || "unknown";
      const effectValue = card.base_effects[0]?.value || 0;
      const effectTarget = card.base_effects[0]?.target || "self";
      
      const targetId = effectTarget === "opponent" 
        ? Object.keys(state.players).find(id => id !== state.activePlayerId) 
        : state.activePlayerId;
        
      // Add a new effect to the queue
      const newEffect = {
        id: Math.random().toString(),
        type: effectType,
        value: effectValue,
        source: state.activePlayerId,
        target: targetId || "",
        card: cardId,
        timing: "immediate" as const,
        timestamp: Date.now(),
        actionId: action.id
      };
        
      return {
        ...state,
        players: updatedPlayers,
        effectQueue: [...state.effectQueue, newEffect],
        actionHistory: [...state.actionHistory, action],
        lastUpdateTime: Date.now()
      };
    
    case ActionType.END_TURN:
      // Simple turn end logic for testing UI
      // Get opponent ID (for a 2-player game)
      const currentPlayerId = state.activePlayerId;
      const nextPlayerId = Object.keys(state.players).find(id => id !== currentPlayerId);
      
      if (!nextPlayerId) return state;
      
      // Update player active status
      const updatedPlayers = {
        ...state.players,
        [currentPlayerId]: {
          ...state.players[currentPlayerId],
          isActive: false
        },
        [nextPlayerId]: {
          ...state.players[nextPlayerId],
          isActive: true,
          // Refresh energy for next player
          energy: state.players[nextPlayerId].maxEnergy
        }
      };
      
      return {
        ...state,
        players: updatedPlayers,
        activePlayerId: nextPlayerId,
        phase: "turnStart",
        turnNumber: state.turnNumber + 1,
        actionHistory: [...state.actionHistory, action],
        lastUpdateTime: Date.now()
      };
    
    case ActionType.PROCESS_QUEUE:
      // Simple queue processing for testing UI
      if (state.effectQueue.length === 0) return state;
      
      // Process the first effect in the queue
      const [effect, ...remainingEffects] = state.effectQueue;
      
      // Apply effect based on type (simple implementation for testing)
      const players = {...state.players};
      
      if (effect.type === "damage" && effect.value) {
        const targetPlayer = players[effect.target];
        // Apply damage, considering block
        const blockAbsorbed = Math.min(targetPlayer.block, effect.value);
        const remainingDamage = effect.value - blockAbsorbed;
        
        players[effect.target] = {
          ...targetPlayer,
          block: targetPlayer.block - blockAbsorbed,
          hp: Math.max(0, targetPlayer.hp - remainingDamage)
        };
      }
      
      if (effect.type === "heal" && effect.value) {
        const targetPlayer = players[effect.target];
        players[effect.target] = {
          ...targetPlayer,
          hp: Math.min(targetPlayer.maxHp, targetPlayer.hp + effect.value)
        };
      }
      
      if (effect.type === "block" && effect.value) {
        const targetPlayer = players[effect.target];
        players[effect.target] = {
          ...targetPlayer,
          block: targetPlayer.block + effect.value
        };
      }
      
      if (effect.type === "energy" && effect.value) {
        const targetPlayer = players[effect.target];
        players[effect.target] = {
          ...targetPlayer,
          energy: Math.min(targetPlayer.maxEnergy, targetPlayer.energy + effect.value)
        };
      }
      
      return {
        ...state,
        players,
        effectQueue: remainingEffects,
        lastUpdateTime: Date.now()
      };
    
    default:
      return state;
  }
}

// UI state reducer
function uiStateReducer(state: UIState, action: any): UIState {
  switch (action.type) {
    case 'SELECT_CARD':
      return {
        ...state,
        selectedCardId: action.payload.cardId
      };
    
    case 'SELECT_TARGET':
      return {
        ...state,
        targetPlayerId: action.payload.playerId
      };
    
    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload.isProcessing
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        errorMessage: action.payload.message
      };
    
    case 'SHOW_CARD_DETAIL':
      return {
        ...state,
        showCardDetail: action.payload.cardId
      };
    
    case 'SET_CONNECTION':
      return {
        ...state,
        isConnected: action.payload.isConnected
      };
    
    case 'SYNC_STATE':
      return {
        ...state,
        lastSyncTime: Date.now()
      };
    
    case 'RESET_UI':
      return {
        ...initialUIState,
        isConnected: state.isConnected
      };
    
    default:
      return state;
  }
}

// Context type definition
interface GameContextType {
  gameState: GameState;
  uiState: UIState;
  dispatch: (action: GameAction) => void;
  dispatchUI: (action: any) => void;
  isCurrentPlayerActive: () => boolean;
  getCurrentPlayer: () => any | null;
  getOpponent: () => any | null;
  canPlayCard: (cardId: string) => boolean;
}

// Create the context
const GameContext = createContext<GameContextType | undefined>(undefined);

// Context provider component
export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, dispatch] = useReducer(gameStateReducer, initialGameState);
  const [uiState, dispatchUI] = useReducer(uiStateReducer, initialUIState);
  
  // Client/server adapter function
  const dispatchAction = (action: GameAction) => {
    // In multiplayer mode, this would send the action to the server first
    if (gameState.isMultiplayer) {
      // Placeholder for server communication
      console.log('Sending action to server:', action);
      // The actual dispatch would happen when the server confirms
      
      // For now, we'll just dispatch locally with a delay to simulate network
      setTimeout(() => {
        dispatch(action);
      }, 300);
    } else {
      // In single player, dispatch directly
      dispatch(action);
    }
  };
  
  // Utility functions
  const isCurrentPlayerActive = () => {
    // Implementation would depend on how we identify the current player
    // This is a placeholder
    return true;
  };
  
  const getCurrentPlayer = () => {
    // Placeholder implementation
    const playerId = Object.keys(gameState.players)[0];
    return playerId ? gameState.players[playerId] : null;
  };
  
  const getOpponent = () => {
    // Placeholder implementation
    const players = Object.values(gameState.players);
    const currentPlayer = getCurrentPlayer();
    return players.find(player => player.id !== currentPlayer?.id) || null;
  };
  
  const canPlayCard = (cardId: string) => {
    // Placeholder implementation
    // In a full implementation, this would check energy, card requirements, etc.
    return isCurrentPlayerActive();
  };
  
  // State synchronization skeleton
  useEffect(() => {
    if (gameState.isMultiplayer) {
      // This would set up WebSocket or polling in a complete implementation
      const syncInterval = setInterval(() => {
        console.log('Syncing state with server...');
        dispatchUI({ type: 'SYNC_STATE' });
      }, 3000);
      
      return () => clearInterval(syncInterval);
    }
  }, [gameState.isMultiplayer]);
  
  return (
    <GameContext.Provider
      value={{
        gameState,
        uiState,
        dispatch: dispatchAction,
        dispatchUI,
        isCurrentPlayerActive,
        getCurrentPlayer,
        getOpponent,
        canPlayCard
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

// Custom hook for using the GameContext
export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}