/**
 * API client for communicating with the backend server
 */

import { GameAction, GameState } from '@/types';

// API base URL from environment variable or default to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Create a new game
 * @param playerId Player identifier
 * @param playerName Player name
 * @param isSinglePlayer Whether this is a single-player game
 */
export const createGame = async (
  playerId: string,
  playerName: string,
  isSinglePlayer: boolean = true
): Promise<{ gameId: string; gameState: GameState }> => {
  const response = await fetch(`${API_BASE_URL}/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playerId,
      playerName,
      isSinglePlayer,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create game');
  }

  return response.json();
};

/**
 * Get current game state
 * @param gameId Game identifier
 */
export const getGameState = async (gameId: string): Promise<{ gameState: GameState }> => {
  const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get game state');
  }

  return response.json();
};

/**
 * Submit a game action
 * @param gameId Game identifier
 * @param action Game action to submit
 */
export const submitAction = async (
  gameId: string,
  action: GameAction
): Promise<{ actionId: string; status: string; timestamp: number; gameState: GameState }> => {
  const response = await fetch(`${API_BASE_URL}/games/${gameId}/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(action),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit action');
  }

  try {
    const result = await response.json();
    console.log("API response:", result);
    
    // Validate that the response contains gameState
    if (!result.gameState) {
      console.error("Server response missing gameState property:", result);
    }
    
    return result;
  } catch (error) {
    console.error("Error parsing API response:", error);
    console.log("Raw response text:", await response.text());
    throw new Error("Failed to parse server response");
  }
};

/**
 * Join an existing game
 * @param gameId Game identifier
 * @param playerId Player identifier
 * @param playerName Player name
 */
export const joinGame = async (
  gameId: string,
  playerId: string,
  playerName: string
): Promise<{ gameId: string; gameState: GameState }> => {
  const response = await fetch(`${API_BASE_URL}/games/${gameId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playerId,
      playerName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to join game');
  }

  return response.json();
};

/**
 * Start a game
 * @param gameId Game identifier
 */
export const startGame = async (
  gameId: string
): Promise<{ gameId: string; gameState: GameState }> => {
  console.log(`Starting game: ${gameId}`);
  const response = await fetch(`${API_BASE_URL}/games/${gameId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start game');
  }

  return response.json();
};