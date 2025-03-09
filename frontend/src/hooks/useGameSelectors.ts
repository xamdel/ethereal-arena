'use client';

import { useGame } from '@/context';
import { Card, Player } from '@/types';

/**
 * Custom hook with game state selectors
 * Provides derived calculations and easy access to common state values
 */
export function useGameSelectors() {
  const { gameState, uiState } = useGame();

  // Get all player cards including hand, deck, and discard
  const getAllPlayerCards = (playerId: string): Card[] => {
    const player = gameState.players[playerId];
    if (!player) return [];
    
    return [
      ...player.hand,
      ...player.deck,
      ...player.discard
    ];
  };

  // Get the current player (you)
  const getCurrentPlayer = (): Player | null => {
    // In a real implementation, this would identify the current player based on session/auth
    // For now, we'll use a placeholder approach
    const players = Object.values(gameState.players);
    if (players.length === 0) return null;
    
    // The first player is considered the current player in this basic implementation
    return players[0];
  };

  // Get the opponent player
  const getOpponent = (): Player | null => {
    const players = Object.values(gameState.players);
    const currentPlayer = getCurrentPlayer();
    
    if (!currentPlayer || players.length < 2) return null;
    
    return players.find(player => player.id !== currentPlayer.id) || null;
  };

  // Check if it's the current player's turn
  const isPlayerTurn = (): boolean => {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return false;
    
    return gameState.activePlayerId === currentPlayer.id;
  };

  // Get playable cards (based on energy, etc.)
  const getPlayableCards = (): Card[] => {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return [];
    
    return currentPlayer.hand.filter(card => card.cost <= currentPlayer.energy);
  };

  // Check if a specific card can be played //TODO: SWITCH TO LLM COST CALCULATOR
  const canPlayCard = (cardId: string): boolean => {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer || !isPlayerTurn()) return false;
    
    const card = currentPlayer.hand.find(c => c.id === cardId);
    if (!card) return false;
    
    return card.cost <= currentPlayer.energy;
  };

  // Get a card by ID from any player's cards
  const getCardById = (cardId: string): Card | null => {
    for (const playerId in gameState.players) {
      const allCards = getAllPlayerCards(playerId);
      const card = allCards.find(c => c.id === cardId);
      if (card) return card;
    }
    
    return null;
  };

  // Get current game phase
  const getGamePhase = () => gameState.phase;

  // Check if the game is over
  const isGameOver = () => gameState.winner !== null;

  // Get winner if game is over
  const getWinner = () => {
    if (!gameState.winner) return null;
    return gameState.players[gameState.winner];
  };

  return {
    getCurrentPlayer,
    getOpponent,
    isPlayerTurn,
    getPlayableCards,
    canPlayCard,
    getCardById,
    getAllPlayerCards,
    getGamePhase,
    isGameOver,
    getWinner,
    selectedCardId: uiState.selectedCardId,
    targetPlayerId: uiState.targetPlayerId,
    isProcessing: uiState.isProcessing,
    errorMessage: uiState.errorMessage,
    showCardDetail: uiState.showCardDetail,
    isConnected: uiState.isConnected
  };
}