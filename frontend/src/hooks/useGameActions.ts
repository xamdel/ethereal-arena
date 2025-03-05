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
  const initGame = (isSinglePlayer: boolean = true, useMockData: boolean = true): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if we should use mock data for testing UI (development mode)
        if (useMockData && process.env.NODE_ENV === 'development') {
          // We'll load mock data asynchronously
          const { createMockGameState } = await import('@/utils/mockData');
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
          resolve();
        } else {
          // For real backend connection, we need to create a game via API
          const playerId = generateActionId();
          
          // Set UI to loading state
          dispatchUI({ 
            type: 'SET_PROCESSING', 
            payload: { isProcessing: true } 
          });
          
          // Import and use the API service
          const { createGame, startGame } = await import('@/services/api');
          
          try {
            // Call the backend API to create a new game
            console.log(`Creating new game for player ${playerId}`);
            const { gameId, gameState } = await createGame(
              playerId,
              'Player', // Default player name
              isSinglePlayer
            );
            
            console.log(`Game created with ID: ${gameId}`);
            
            // Now start the game to generate cards
            console.log(`Starting game: ${gameId}`);
            const { gameState: startedGameState } = await startGame(gameId);
            
            console.log(`Game started successfully`);
            console.log(`Hand sizes after game start:`);
            Object.keys(startedGameState.players).forEach(id => {
              const handSize = startedGameState.players[id].hand?.length || 0;
              console.log(`- Player ${id}: ${handSize} cards`);
            });
            
            // Initialize with the returned game state
            const action: GameAction = {
              id: generateActionId(),
              type: ActionType.GAME_INIT,
              playerId: 'system',
              payload: {
                ...startedGameState,
                isMultiplayer: !isSinglePlayer
              },
              timestamp: Date.now(),
              gameId: gameId,
              validated: true
            };
            
            dispatch(action);
            resolve();
          } catch (error) {
            console.error("Error creating game with backend:", error);
            // Fall back to mock data
            initializeEmptyGame(isSinglePlayer);
            // Show error to user
            dispatchUI({
              type: 'SET_ERROR',
              payload: { message: 'Failed to connect to game server. Using offline mode.' }
            });
            reject(error);
          } finally {
            // Reset loading state
            dispatchUI({ 
              type: 'SET_PROCESSING', 
              payload: { isProcessing: false } 
            });
          }
        }
      } catch (error) {
        console.error("Error in initGame:", error);
        initializeEmptyGame(isSinglePlayer);
        reject(error);
      }
    });
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
  
  // Select initial cards after draft
  const selectInitialCards = (selectedCardIds: string[]) => {
    dispatchUI({ 
      type: 'SET_PROCESSING', 
      payload: { isProcessing: true } 
    });
    
    const action: GameAction = {
      id: generateActionId(),
      type: ActionType.SELECT_CARDS,
      playerId: gameState.activePlayerId,
      payload: {
        selectedCardIds
      },
      timestamp: Date.now(),
      gameId: gameState.id,
      validated: false
    };
    
    // Dispatch the action
    dispatch(action);
    
    // Reset UI state after processing
    setTimeout(() => {
      dispatchUI({ 
        type: 'SET_PROCESSING', 
        payload: { isProcessing: false } 
      });
    }, 500);
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
    clearError,
    selectInitialCards
  };
}