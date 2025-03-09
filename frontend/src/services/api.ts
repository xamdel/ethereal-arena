/**
 * API client for communicating with the backend server.
 *
 * Note: Most API functionality has been migrated to WebSockets.
 * This file contains only the remaining REST API endpoints.
 */

import { GameState } from '@/types';

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
