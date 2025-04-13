import { useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  emitStartGame,
  emitSelectCards,
} from '../services/socketService';

// Provides functions for dispatching game-related actions via socket events.
export const useGameActions = () => {
  const startGame = useCallback(({ name, playerClass, isSinglePlayer }) => {
    console.log(`Starting game for ${name} (${playerClass}), SinglePlayer: ${isSinglePlayer}`);
    const tempGameId = `temp-${crypto.randomUUID()}`;
    const playerId = `player-${crypto.randomUUID()}`; // Generate client-side ID

    // Set player ID optimistically in the store
    useGameStore.getState().setPlayerId(playerId);
    useGameStore.getState().addLogEntry({ type: 'system', content: `Attempting to start game as ${name} (${playerClass})...` });

    // Emit the event to the server
    emitStartGame(tempGameId, playerId, name, isSinglePlayer);
    // Navigation to 'selection' screen will be handled by the 'game-started' event listener in useSocketEvents
  }, []);

  const selectCards = useCallback((selectedCardIds) => {
    console.log('Selected cards:', selectedCardIds);
    const currentGameState = useGameStore.getState().gameState;
    const currentPlayerId = useGameStore.getState().playerId;

    if (currentGameState && currentPlayerId) {
      useGameStore.getState().addLogEntry({ type: 'system', content: `Confirming starting hand...` });
      emitSelectCards(currentGameState.id, currentPlayerId, selectedCardIds);
      // Navigation to 'game' screen should ideally be triggered by a subsequent 'game-state-update'
      // confirming the selection phase is over, handled in useSocketEvents.
      // We don't navigate directly here anymore.
    } else {
      console.error("Cannot select cards: Missing gameId or playerId in store.");
      useGameStore.getState().addLogEntry({ type: 'error', content: `Failed to confirm card selection (missing game/player ID).` });
    }
  }, []);

  return {
    startGame,
    selectCards,
  };
};
