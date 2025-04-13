import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  addSocketListener,
  removeSocketListener,
  getSocket,
} from '../services/socketService';

// This hook manages the setup and cleanup of socket event listeners.
// It interacts with the game store to update state based on events.
// It accepts navigation functions to trigger screen changes on certain events.
export const useSocketEvents = (navigateToSelection, navigateToGame) => {
  useEffect(() => {
    const socket = getSocket(); // Ensure socket is connected elsewhere (e.g., main.jsx)

    if (!socket) {
        console.warn("useSocketEvents: Socket not available on mount.");
        // Consider how to handle this - maybe retry or rely on connect event?
        // For now, we proceed assuming connectSocket was called earlier.
    }

    // Access actions via getState() inside handlers
    const handleConnect = () => useGameStore.getState().setConnectionStatus(true);
    const handleDisconnect = () => useGameStore.getState().setConnectionStatus(false);

    const handleGameStateUpdate = (data) => {
      console.log('[Socket Event] game-state-update received:', data);
      useGameStore.getState().setGameState(data.gameState);
      // Potentially add a system log message
      const logEntry = data.action
        ? { type: 'system', content: `Action ${data.action.type} processed.` }
        : { type: 'system', content: `Game state updated.` };
      useGameStore.getState().addLogEntry(logEntry);
    };

    const handleGameStarted = (data) => {
        console.log('[Socket Event] game-started received:', data);
        useGameStore.getState().setGameState(data.gameState);
        const playerIds = Object.keys(data.gameState.players);
        if (playerIds.length > 0) {
            // TODO: This assumes the first player ID is ours. Might need refinement
            // if multiple players can be in the initial state data.
            useGameStore.getState().setPlayerId(playerIds[0]);
        }
        useGameStore.getState().addLogEntry({ type: 'system', content: `Game started! ID: ${data.gameState.id}` });
        navigateToSelection(); // Use the passed-in navigation function
    };

    const handleGameJoined = (data) => {
        console.log('[Socket Event] game-joined received:', data);
        useGameStore.getState().setGameState(data.gameState);
        // setPlayerId(data.playerId); // Backend should confirm player ID via game state
        useGameStore.getState().addLogEntry({ type: 'system', content: `Joined game: ${data.gameState.id}` });
        navigateToGame(); // Use the passed-in navigation function
    };

    // --- Stream Handling Listeners ---
    const handleStreamStart = (data) => {
        console.log('[Socket Event] llm-stream-start received:', data);
        const logId = useGameStore.getState().addLogEntry({
            type: 'narrative',
            content: '',
            streaming: true,
            cardId: data.cardId,
            playerId: data.playerId,
        });
        if (data.correlationId) {
             useGameStore.getState().startStreamTracking(data.correlationId, logId);
        } else {
             console.warn("Stream start event missing correlationId, cannot track chunks accurately.");
        }
    };

    const handleStreamChunk = (data) => {
        if (data.correlationId) {
            useGameStore.getState().appendStreamChunk(data);
        } else {
             console.warn("Stream chunk missing correlationId, cannot append.");
        }
    };

    const handleStreamEnd = (data) => {
        console.log('[Socket Event] llm-stream-end received:', data);
        // Logic is handled within appendStreamChunk/handleStreamError in the store
        if (data.correlationId) {
            useGameStore.getState().endStreamTracking(data.correlationId);
        }
    };

     const handleStreamErrorEvent = (data) => {
        console.error('[Socket Event] llm-stream-error received:', data);
        if (data.correlationId) {
            useGameStore.getState().handleStreamError(data);
        } else {
            useGameStore.getState().addLogEntry({ type: 'error', content: `Untracked stream error: ${data.message}` });
        }
     };


    // Register listeners using the service
    addSocketListener('connect', handleConnect);
    addSocketListener('disconnect', handleDisconnect);
    addSocketListener('game-state-update', handleGameStateUpdate);
    addSocketListener('game-started', handleGameStarted);
    addSocketListener('game-joined', handleGameJoined);
    addSocketListener('llm-stream-start', handleStreamStart);
    addSocketListener('llm-stream-chunk', handleStreamChunk);
    addSocketListener('llm-stream-end', handleStreamEnd);
    addSocketListener('llm-stream-error', handleStreamErrorEvent);


    // Cleanup listeners on component unmount
    return () => {
      removeSocketListener('connect', handleConnect);
      removeSocketListener('disconnect', handleDisconnect);
      removeSocketListener('game-state-update', handleGameStateUpdate);
      removeSocketListener('game-started', handleGameStarted);
      removeSocketListener('game-joined', handleGameJoined);
      removeSocketListener('llm-stream-start', handleStreamStart);
      removeSocketListener('llm-stream-chunk', handleStreamChunk);
      removeSocketListener('llm-stream-end', handleStreamEnd);
      removeSocketListener('llm-stream-error', handleStreamErrorEvent);
    };
    // Dependencies: The navigation functions. If they change, re-run the effect.
  }, [navigateToSelection, navigateToGame]);

  // This hook doesn't need to return anything as it only sets up side effects.
};
