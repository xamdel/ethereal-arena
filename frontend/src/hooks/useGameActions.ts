'use client';

import { useGame } from '@/context';
import { Card, GameAction, ActionType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { gameSync } from '../hooks/useGameSync';
import { useCallback } from 'react';

/**
 * Custom hook with game action creators
 * Provides functions to dispatch common game actions
 */
export function useGameActions() {
  const { 
    gameState,
    dispatch,
    dispatchUI,
    calculateCardEnergyCost,
    clearCardEnergyCosts,
    getCardEnergyCost
  } = useGame();

  // Action sequence number
  let actionSequenceNumber = 0;

  // Generate a unique action ID with a sequence number
  const generateActionId = useCallback((): string => {
    actionSequenceNumber++;
    return `${uuidv4()}-${actionSequenceNumber}`;
  }, []);

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
    
            resolve();
        }
    else {
      // For real backend connection, we need to create a game via API
      const playerId = generateActionId();
          
          // Set UI to loading state
          dispatchUI({ 
            type: 'SET_PROCESSING', 
            payload: { isProcessing: true } 
          });
          
          // Import and use the API service
          const { createGame } = await import('@/services/api');

          try {
            // Call the backend API to create a new game
            console.log(`Creating new game for player ${playerId}`);
            const { gameId, gameState } = await createGame(
              playerId,
              'Player', // Default player name
              isSinglePlayer
            );

            console.log(`Game created with ID: ${gameId}`);

            // Initialize the game sync with the game state to set up event listeners
            // Use actual dispatch functions so the game state will be updated when
            // we receive the 'game-started' event with the cards
            gameSync.initialize({...gameState, id: gameId}, dispatch, dispatchUI);
            
            // Start the game using the socket's 'start-game' event
            // This will trigger the server's dedicated start game handler that generates cards
            const socketService = await import('@/services/socket');
            const result = await socketService.startGame(gameId, playerId);
            
            // Log for debugging
            console.log('Game started with cards:', result.gameState?.players[playerId]?.hand?.length || 0);

            resolve();
          } catch (error) {
            console.error('Error creating game with backend:', error);
            console.log('Attempting to fall back to mock data...');
            // Fall back to mock data
            initializeEmptyGame(isSinglePlayer);
            // Show error to user
            dispatchUI({
              type: 'SET_ERROR',
              payload: { message: 'Failed to connect to game server. Using offline mode.' },
            });
            reject(error);
          } finally {
            // Reset loading state
            dispatchUI({
              type: 'SET_PROCESSING',
              payload: { isProcessing: false },
            });
          }
        }
      } catch (error) {
        console.error('Error in initGame:', error);
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

  };

  // Play a card
  const playCard = useCallback(async (cardId: string, targetPlayerId?: string) => {
    console.log('[Debug] Starting playCard function with:', { cardId, targetPlayerId });
    
    // Validate game state before proceeding
    if (!gameState.id) {
      console.error('playCard: Game ID is not set');
      dispatchUI({
        type: 'SET_ERROR',
        payload: { message: 'Game not initialized - cannot play card' }
      });
      return;
    }

    const playerID = gameState.activePlayerId;
    if (!playerID) {
      console.error('playCard: Active player ID is not set');
      dispatchUI({
        type: 'SET_ERROR',
        payload: { message: 'No active player - cannot play card' }
      });
      return;
    }
    
    // Set UI state to processing
    dispatchUI({ 
      type: 'SET_PROCESSING', 
      payload: { isProcessing: true } 
    });

    try {
      console.log(`Playing card ${cardId}${targetPlayerId ? ` targeting ${targetPlayerId}` : ''}`);

      // Get the cached energy cost calculation
      const energyCost = getCardEnergyCost(cardId);
      
      // If we have a cached calculation and the card can't be played, show an error
      if (energyCost && !energyCost.canPlay) {
        console.log(`Cannot play card ${cardId}: ${energyCost.reason}`);
        dispatchUI({ 
          type: 'SET_ERROR', 
          payload: { message: `Cannot play card: ${energyCost.reason}` } 
        });
        return;
      }
      
      // Store the card information for immediate access to on_play_description
      const player = gameState.players[playerID];
      const card = player.hand.find(c => c.id === cardId);
      
      console.log('[Debug] Found card to play:', card);
      console.log('[Debug] Card has on_play_description:', card?.on_play_description);
      
      if (card) {
        // Store the card in UI state for immediate access
        dispatchUI({
          type: 'SET_LAST_PLAYED_CARD',
          payload: { card }
        });
        
        console.log('[Debug] Set lastPlayedCard in UI state:', card.id);
        
        // Add immediate on_play_description to the log if available
        if (card.on_play_description) {
          dispatchUI({
            type: 'ADD_LOG_ENTRY',
            payload: {
              type: 'on-play-description',
              content: card.on_play_description.replace(/\[player\]/g, player.name || 'You')
                .replace(/\[opponent\]/g, Object.values(gameState.players).find(p => p.id !== playerID)?.name || 'opponent'),
              cardId,
              playerId: playerID
            }
          });
        }
      }
      // Using dispatch to trigger the updated server communication flow
      await gameSync.sendAction({
        id: generateActionId(),
        type: ActionType.PLAY_CARD,
        playerId: playerID,
        payload: {
          cardId,
          targetPlayerId,
        },
        timestamp: Date.now(),
        gameId: gameState.id,
        validated: false // Validation happens on the server
      }, { streamResponse: true });

      console.log('Card played successfully');

      // Clear the energy cost cache since the state has changed
      clearCardEnergyCosts();
    } catch (error) {
      console.error('Error playing card:', error);
      dispatchUI({
        type: 'SET_ERROR',
        payload: { message: 'Failed to play card. Please try again.' }
      });
    } finally {
      dispatchUI({
        type: 'SET_PROCESSING',
        payload: { isProcessing: false }
      });
    }
  }, [gameState, dispatchUI, generateActionId, getCardEnergyCost, clearCardEnergyCosts]);

  // End the current turn
  const endTurn = useCallback(async () => {
    try {
      dispatchUI({ 
        type: 'SET_PROCESSING', 
        payload: { isProcessing: true } 
      });
      
      console.log('Ending turn');
      
      // Use the active player ID directly from the game state
      const playerID = gameState.activePlayerId || 'unknown';
      
      await gameSync.sendAction({
        id: generateActionId(),
        type: ActionType.END_TURN,
        playerId: playerID,
        payload: {},
        timestamp: Date.now(),
        gameId: gameState.id,
        validated: false
      });
      
      console.log('Turn ended successfully');
    } catch (error) {
      console.error('Error ending turn:', error);
      dispatchUI({ 
        type: 'SET_ERROR', 
        payload: { message: 'Failed to end turn. Please try again.' } 
      });
    } finally {
      dispatchUI({ 
        type: 'SET_PROCESSING', 
        payload: { isProcessing: false } 
      });
    }
  }, [gameState, dispatchUI, generateActionId]);

  // Select a card from hand (UI action)
  const selectCard = async (cardId: string) => {
    dispatchUI({
      type: 'SELECT_CARD',
      payload: { cardId }
    });
    
    // Calculate energy cost for the selected card
    try {
      await calculateCardEnergyCost(cardId);
    } catch (error) {
      console.error("Error calculating card energy cost:", error);
    }
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
  const selectInitialCards = async (selectedCardIds: string[]) => {
    dispatchUI({ 
      type: 'SET_PROCESSING', 
      payload: { isProcessing: true } 
    });
    
    try {
      console.log(`Selecting ${selectedCardIds.length} initial cards`);
      
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
      
      await gameSync.sendAction(action);
      
      console.log('Initial cards selected successfully');
    } catch (error) {
      console.error('Error selecting initial cards:', error);
      dispatchUI({ 
        type: 'SET_ERROR', 
        payload: { message: 'Failed to select cards. Please try again.' } 
      });
    } finally {
      dispatchUI({ 
        type: 'SET_PROCESSING', 
        payload: { isProcessing: false } 
      });
    }
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