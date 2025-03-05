'use client';

import { useGame } from '@/context';
import { Card, GameAction, ActionType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom hook with game action creators
 * Provides functions to dispatch common game actions
 */
export function useGameActions() {
  const { gameState, dispatch, dispatchUI } = useGame();

  // Generate a unique action ID
  const generateActionId = (): string => {
    return uuidv4();
  };

  // Initialize a new game
  const initGame = (isSinglePlayer: boolean = true, useMockData: boolean = true) => {
    // Check if we should use mock data for testing UI (development mode)
    if (useMockData && process.env.NODE_ENV === 'development') {
      // We'll load mock data asynchronously
      import('@/utils/mockData').then(({ createMockGameState }) => {
        // Use mock data for testing the UI
        const mockGameState = createMockGameState();
        
        const action: GameAction = {
          id: generateActionId(),
          type: ActionType.GAME_INIT,
          playerId: 'system',
          payload: {
            // Use mock data for testing
            ...mockGameState,
            isMultiplayer: !isSinglePlayer
          },
          timestamp: Date.now(),
          gameId: mockGameState.id,
          validated: true
        };
  
        dispatch(action);
      }).catch(error => {
        console.error("Error loading mock data:", error);
        initializeEmptyGame(isSinglePlayer);
      });
    } else {
      // Use normal initialization (empty state to be filled by server)
      initializeEmptyGame(isSinglePlayer);
    }
  };
  
  // Helper for initializing with empty game state
  const initializeEmptyGame = (isSinglePlayer: boolean) => {
    const action: GameAction = {
      id: generateActionId(),
      type: ActionType.GAME_INIT,
      playerId: 'system',
      payload: {
        // Initial game setup would come from the server in a real implementation
        // This is a placeholder for basic local testing
        id: generateActionId(),
        players: {}, // Will be populated by server
        activePlayerId: '',
        turnNumber: 0,
        phase: 'init',
        effectQueue: [],
        actionHistory: [],
        turnStartTime: Date.now(),
        lastUpdateTime: Date.now(),
        winner: null,
        isMultiplayer: !isSinglePlayer
      },
      timestamp: Date.now(),
      gameId: generateActionId(),
      validated: true
    };

    dispatch(action);
  };

  // Play a card
  const playCard = (cardId: string, targetPlayerId?: string) => {
    // Set UI state to processing
    dispatchUI({ 
      type: 'SET_PROCESSING', 
      payload: { isProcessing: true } 
    });

    const action: GameAction = {
      id: generateActionId(),
      type: ActionType.PLAY_CARD,
      playerId: 'current', // In a real implementation, this would be the current player's ID
      payload: {
        cardId,
        targetPlayerId
      },
      timestamp: Date.now(),
      gameId: gameState.id,
      validated: false // Validation happens on the server or game engine
    };

    dispatch(action);

    // Reset UI state after processing (in a real implementation, this would happen after server response)
    setTimeout(() => {
      dispatchUI({ 
        type: 'SET_PROCESSING', 
        payload: { isProcessing: false } 
      });
      dispatchUI({ 
        type: 'RESET_UI' 
      });
    }, 500);
  };

  // End the current turn
  const endTurn = () => {
    const action: GameAction = {
      id: generateActionId(),
      type: ActionType.END_TURN,
      playerId: 'current', // In a real implementation, this would be the current player's ID
      payload: {},
      timestamp: Date.now(),
      gameId: gameState.id,
      validated: false
    };

    dispatch(action);
  };

  // Select a card from hand (UI action)
  const selectCard = (cardId: string) => {
    dispatchUI({
      type: 'SELECT_CARD',
      payload: { cardId }
    });
  };

  // Select a target player (UI action)
  const selectTarget = (playerId: string) => {
    dispatchUI({
      type: 'SELECT_TARGET',
      payload: { playerId }
    });
  };

  // Show card detail (UI action)
  const showCardDetail = (cardId: string) => {
    dispatchUI({
      type: 'SHOW_CARD_DETAIL',
      payload: { cardId }
    });
  };

  // Hide card detail (UI action)
  const hideCardDetail = () => {
    dispatchUI({
      type: 'SHOW_CARD_DETAIL',
      payload: { cardId: null }
    });
  };

  // Set error message (UI action)
  const setError = (message: string) => {
    dispatchUI({
      type: 'SET_ERROR',
      payload: { message }
    });
  };

  // Clear error message (UI action)
  const clearError = () => {
    dispatchUI({
      type: 'SET_ERROR',
      payload: { message: null }
    });
  };

  return {
    initGame,
    playCard,
    endTurn,
    selectCard,
    selectTarget,
    showCardDetail,
    hideCardDetail,
    setError,
    clearError
  };
}