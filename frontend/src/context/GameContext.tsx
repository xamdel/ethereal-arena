'use client';

import { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { GameState, GameAction, ActionType, Card, Player } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import useGameSync, { gameSync } from '@/hooks/useGameSync';

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
  // Store the last played card for immediate access to on_play_description
  lastPlayedCard: Card | null;
  // Streaming state
  isStreaming: boolean;
  activeStreamCardId: string | null;
  streamingError: string | null;
  // Log entries for streaming updates
  logEntries: {
    type: string;
    content: string;
    cardId?: string;
    playerId?: string;
    timestamp: number;
  }[];
  // Store energy cost calculations for highlighted cards
  cardEnergyCosts: {
    [cardId: string]: {
      canPlay: boolean;
      energyCost: number;
      reason: string;
      calculatedAt: number;
    }
  };
}

const initialUIState: UIState = {
  selectedCardId: null,
  targetPlayerId: null,
  isProcessing: false,
  errorMessage: null,
  showCardDetail: null,
  isConnected: false,
  lastSyncTime: 0,
  lastPlayedCard: null,
  isStreaming: false,
  activeStreamCardId: null,
  streamingError: null,
  logEntries: [],
  cardEnergyCosts: {}
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
      if (activePlayer.energy < card.cost) return state; //TODO: switch to cost calculator LLM
      
      // Remove the card from hand and add to discard
      const updatedHand = [...activePlayer.hand];
      const removedCard = updatedHand.splice(cardIndex, 1)[0];
      
      const playCardUpdatedPlayers = {
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
        id: uuidv4(),
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
        players: playCardUpdatedPlayers,
        effectQueue: [...state.effectQueue, newEffect],
        actionHistory: [...state.actionHistory, action],
        lastUpdateTime: Date.now()
      };
      
    case ActionType.SELECT_CARDS:
      // Handle card selection for draft phase
      const { selectedCardIds } = action.payload;
      const draftingPlayer = state.players[state.activePlayerId];
      
      if (!draftingPlayer) return state;
      
      // Filter the hand to keep only the selected cards
      const draftedHand = draftingPlayer.hand.filter(card => 
        selectedCardIds.includes(card.id)
      );
      
      // Move to action phase
      return {
        ...state,
        players: {
          ...state.players,
          [state.activePlayerId]: {
            ...draftingPlayer,
            hand: draftedHand
          }
        },
        phase: 'action',
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
      const endTurnUpdatedPlayers = {
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
        players: endTurnUpdatedPlayers,
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
    
    case 'SET_STREAMING':
      return {
        ...state,
        isStreaming: action.payload.isStreaming,
        activeStreamCardId: action.payload.cardId || null,
        streamingError: action.payload.error || null
      };
    
    case 'ADD_LOG_ENTRY':
      // Prevent duplicate entries for the same content
      const isDuplicate = state.logEntries.some(entry => 
        entry.type === action.payload.type && 
        entry.content === action.payload.content &&
        entry.cardId === action.payload.cardId
      );
      
      if (isDuplicate) {
        return state;
      }
      
      return {
        ...state,
        logEntries: [
          ...state.logEntries,
          {
            type: action.payload.type,
            content: action.payload.content,
            cardId: action.payload.cardId,
            playerId: action.payload.playerId,
            timestamp: Date.now()
          }
        ]
      };
    
    case 'UPDATE_CARD_ENERGY_COST':
      return {
        ...state,
        cardEnergyCosts: {
          ...state.cardEnergyCosts,
          [action.payload.cardId]: {
            canPlay: action.payload.canPlay,
            energyCost: action.payload.energyCost,
            reason: action.payload.reason,
            calculatedAt: Date.now()
          }
        }
      };
    
    case 'SET_LAST_PLAYED_CARD':
      return {
        ...state,
        lastPlayedCard: action.payload.card
      };
      
    case 'CLEAR_CARD_ENERGY_COSTS':
      return {
        ...state,
        cardEnergyCosts: {}
      };
    
    case 'CLEAR_LOG_ENTRIES':
      return {
        ...state,
        logEntries: []
      };
    
    case 'RESET_UI':
      return {
        ...initialUIState,
        isConnected: state.isConnected,
        lastPlayedCard: state.lastPlayedCard, // Preserve the last played card
        logEntries: state.logEntries // Keep log entries
      };
    
    default:
      return state;
  }
}

// Context type definition
interface GameContextType {
  gameState: GameState;
  uiState: UIState;
  dispatch: (action: GameAction) => Promise<any>;
  dispatchUI: (action: GameUIAction) => void;
  isCurrentPlayerActive: () => boolean;
  getCurrentPlayer: () => Player | null;
  getOpponent: () => Player | null;
  canPlayCard: (cardId: string) => boolean;
  calculateCardEnergyCost: (cardId: string) => Promise<void>;
  clearCardEnergyCosts: () => void;
  getCardEnergyCost: (cardId: string) => { canPlay: boolean; energyCost: number; reason: string } | null;
  connectionState: "connected" | "disconnected" | "reconnecting";
}

interface GameUIAction {
  type: string;
  payload: any;
}

// Create the context
const GameContext = createContext<GameContextType | undefined>(undefined);

// Context provider component
export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, dispatch] = useReducer(gameStateReducer, initialGameState);
  const [uiState, dispatchUI] = useReducer(uiStateReducer, initialUIState);
  
  // Initialize game sync once on mount, not on every render
  useEffect(() => {
    // Only initialize with the initial state, not the current state
    // to avoid re-initializing on every state change
    gameSync.initialize(initialGameState, dispatch, dispatchUI);
  }, []);
  
  // Client/server adapter function
    const dispatchAction = async (action: GameAction) => {
        // Fix playerId if it's set to 'current'
        if (action.playerId === 'current') {
            const currentPlayer = getCurrentPlayer();
            if (currentPlayer) {
                action.playerId = currentPlayer.id;
            }
        }

        console.log('Dispatching action:', action.type);

        // Initialize actions - we'll handle game initialization locally
        if (action.type === ActionType.GAME_INIT) {
            dispatch(action);
            return;
        }

        // Delegate all other actions to useGameSync
        try {
            await gameSync.sendAction(action, { streamResponse: action.type === ActionType.PLAY_CARD });
        } catch (error) {
            console.error("Error sending action:", error);
            dispatchUI({
                type: 'SET_ERROR',
                payload: { message: 'Failed to communicate with game server.' }
            });
        }
    };
  
  // Utility functions
  const isCurrentPlayerActive = () => {
    // For now, in a single-player game, the human player is always player one
    // This approach simplifies the UI but will need to change for multiplayer
    const humanPlayerId = Object.keys(gameState.players).find(id => !id.includes('ai'));
    
    // Check if the human player is the active player
    return humanPlayerId === gameState.activePlayerId;
  };
  
  const getCurrentPlayer = () => {
    // Get the active player from the game state
    if (gameState.activePlayerId && gameState.players[gameState.activePlayerId]) {
      return gameState.players[gameState.activePlayerId];
    }
    // Fallback to first player if no active player
    const playerId = Object.keys(gameState.players)[0];
    return playerId ? gameState.players[playerId] : null;
  };
  
  const getOpponent = () => {
    // Get opponent (non-active player)
    if (!gameState.activePlayerId) {
      return null;
    }
    
    // Find the player that is not the active player
    const opponentId = Object.keys(gameState.players).find(
      id => id !== gameState.activePlayerId
    );
    
    return opponentId ? gameState.players[opponentId] : null;
  };
  
  const canPlayCard = (cardId: string) => {
    // First check if it's the player's turn
    if (!isCurrentPlayerActive()) {
      return false;
    }
    
    // Get the active player
    const player = getCurrentPlayer();
    if (!player) {
      return false;
    }
    
    // Find the card in the player's hand
    const card = player.hand.find(c => c.id === cardId);
    if (!card) {
      return false;
    }
    
    // Check if we have a cached energy cost calculation
    const energyCost = getCardEnergyCost(cardId);
    if (energyCost) {
      return energyCost.canPlay;
    }
    
    // Fallback to basic cost check if no calculation is available
    return player.energy >= card.cost;
  };
  
  // Get cached energy cost calculation for a card
  const getCardEnergyCost = (cardId: string) => {
    const cachedCost = uiState.cardEnergyCosts[cardId];
    if (!cachedCost) {
      return null;
    }
    
    // Return cached calculation
    return {
      canPlay: cachedCost.canPlay,
      energyCost: cachedCost.energyCost,
      reason: cachedCost.reason
    };
  };
  
  // Calculate energy cost for a card (using WebSocket)
  const calculateCardEnergyCost = async (cardId: string) => {
    // Get player data and capture all necessary values to avoid reference closure issues
    const player = getCurrentPlayer();
    const currentGameId = gameState.id;
    
    if (!player || !currentGameId) {
      return;
    }
    
    // Find the card and store relevant info locally
    const card = player.hand.find(c => c.id === cardId);
    if (!card) {
      return;
    }
    
    // Store player details needed for fallback
    const playerEnergy = player.energy;
    const cardBaseCost = card.cost;
    const playerId = player.id;
    
    try {
      // Import socket for sending WebSocket action
      const { sendGameAction, onActionReceived } = await import('@/services/socket');
      
      // Generate a correlation ID for this request
      const correlationId = `energy-cost-${cardId}-${Date.now()}`;
      
      // Create a promise to handle the async response
      const responsePromise = new Promise((resolve, reject) => {
        // Set up a one-time listener for the response
        const unsubscribe = onActionReceived((data) => {
          // Check if this is the response to our request
          if (data.correlationId === correlationId && data.cardId === cardId) {
            // Clean up the listener
            unsubscribe();
            // Resolve with the cost calculation result
            resolve(data);
          }
        });
        
        // Set a timeout to reject the promise if we don't get a response
        setTimeout(() => {
          unsubscribe();
          reject(new Error("Card cost calculation timed out"));
        }, 10000); // 10 second timeout
      });
      
      // Send a specific action to calculate the energy cost via WebSocket
      console.log(`Calculating energy cost for card ${cardId} via WebSocket...`);
      await sendGameAction(
        currentGameId,
        {
          id: `energy-cost-${cardId}-${Date.now()}`,
          type: "CALCULATE_CARD_COST", // Custom action type for energy calculation
          playerId: playerId,
          payload: {
            cardId
          },
          timestamp: Date.now(),
          gameId: currentGameId,
          validated: false,
          correlationId: correlationId
        }
      );
      
      // Wait for the response
      const result = await responsePromise;
      console.log(`Energy cost calculation result:`, result);
      
      // Update UI state with the calculation
      dispatchUI({
        type: 'UPDATE_CARD_ENERGY_COST',
        payload: {
          cardId,
          canPlay: result.canPlay,
          energyCost: result.energyCost,
          reason: result.reason
        }
      });
    } catch (error) {
      console.error("Error calculating card energy cost:", error);
      // Use fallback if calculation fails
      dispatchUI({
        type: 'UPDATE_CARD_ENERGY_COST',
        payload: {
          cardId,
          canPlay: playerEnergy >= cardBaseCost,
          energyCost: cardBaseCost,
          reason: "Using base cost (calculation failed)"
        }
      });
    }
  };
  
  // Clear all cached energy cost calculations
  const clearCardEnergyCosts = async () => {
    // Clear the UI state first
    dispatchUI({ type: 'CLEAR_CARD_ENERGY_COSTS' });
    
    // Store necessary values to avoid referencing gameState in closure
    const currentGameId = gameState.id;
    const currentPlayer = getCurrentPlayer();
    
    // Also clear on the server if a game is active
    // But only if this was triggered by a user action, not by a game state update
    if (currentGameId && currentPlayer && !gameState.actionHistory.some(action => 
      action.type === ActionType.GAME_INIT && 
      action.timestamp > Date.now() - 1000)) {
      try {
        // Use WebSocket to clear cost cache
        const { sendGameAction, onActionReceived } = await import('@/services/socket');
        
        // Generate a correlation ID for this request
        const correlationId = `clear-cost-${Date.now()}`;
        
        // Create a promise to handle the async response
        const responsePromise = new Promise((resolve, reject) => {
          // Set up a one-time listener for the response
          const unsubscribe = onActionReceived((data) => {
            // Check if this is the response to our request
            if (data.correlationId === correlationId) {
              // Clean up the listener
              unsubscribe();
              // Resolve with the result
              resolve(data);
            }
          });
          
          // Set a timeout to reject the promise if we don't get a response
          setTimeout(() => {
            unsubscribe();
            reject(new Error("Clear cost cache timed out"));
          }, 5000); // 5 second timeout
        });
        
        // Send the action
        await sendGameAction(
          currentGameId,
          {
            id: `clear-energy-cost-${Date.now()}`,
            type: "CLEAR_CARD_COST_CACHE",
            playerId: currentPlayer.id,
            payload: {},
            timestamp: Date.now(),
            gameId: currentGameId,
            validated: false,
            correlationId: correlationId
          }
        );
        
        // Wait for the response
        await responsePromise;
      } catch (error) {
        console.error("Error clearing card energy cost cache:", error);
      }
    }
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
  
  // Clear cache when game state changes - but only for local actions, not server updates
  useEffect(() => {
    // Store the current length of action history to avoid reference issues
    const actionHistoryLength = gameState.actionHistory.length;
    
    // Only clear cache if we have actions in the history (avoid first render)
    if (actionHistoryLength > 0) {
      // Get the most recent action
      const lastAction = gameState.actionHistory[actionHistoryLength - 1];
      
      // Only clear cache if this is a local action (not a server state update)
      // Skip GAME_INIT actions to avoid the infinite loop
      if (lastAction && lastAction.type !== ActionType.GAME_INIT) {
        // Use setTimeout to break the potential render cycle
        const timer = setTimeout(() => {
          // Clear UI state cache of energy costs (but don't send to server)
          dispatchUI({ type: 'CLEAR_CARD_ENERGY_COSTS' });
        }, 0);
        
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.actionHistory.length]);

  // Use the new gameSync hook for reactive state
  const { connectionState: rawConnectionState } = useGameSync();
  const connectionState = rawConnectionState === 'reconnecting' 
    ? 'reconnecting' 
    : rawConnectionState;
    
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
        canPlayCard,
        calculateCardEnergyCost,
        clearCardEnergyCosts,
        getCardEnergyCost,
        connectionState
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