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
      // In a full implementation, this would handle card play logic
      // For now, it's a placeholder
      return {
        ...state,
        lastUpdateTime: Date.now()
      };
    
    case ActionType.END_TURN:
      // In a full implementation, this would handle turn end logic
      // For now, it's a placeholder
      return {
        ...state,
        lastUpdateTime: Date.now()
      };
    
    case ActionType.PROCESS_QUEUE:
      // In a full implementation, this would process the effect queue
      // For now, it's a placeholder
      return {
        ...state,
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