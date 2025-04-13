import { create } from 'zustand';

// Define the initial state structure
const initialState = {
  isConnected: false,
  gameId: null,
  playerId: null, // This client's player ID
  gameState: null, // Will hold the full GameState object from the server
  isConnecting: false,
  isLoading: false, // General loading state
  error: null,
  combatLog: [], // Array to hold combat log entries
  // Example log entry: { id: string, type: 'system'|'damage'|'heal'|'narrative'|'effect', content: string, timestamp: number, streaming?: boolean, cardId?: string, playerId?: string }
  activeStreams: {}, // Track ongoing streams: { [correlationId]: { logEntryId: string, fullContent: string } }
};

export const useGameStore = create((set, get) => ({
  ...initialState,

  // --- Actions ---

  setConnectionStatus: (isConnected) => set({ isConnected }),

  setIsConnecting: (isConnecting) => set({ isConnecting }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  // Action to replace the entire game state
  setGameState: (newGameState) => {
    console.log('[Store] Updating Game State:', newGameState);
    set({ gameState: newGameState, gameId: newGameState?.id });
  },

  // Action to set the local player ID
  setPlayerId: (playerId) => set({ playerId }),

  // --- Combat Log Actions ---

  addLogEntry: (entry) => {
    // Add unique ID and timestamp if not provided
    const newEntry = {
      id: entry.id || crypto.randomUUID(),
      timestamp: entry.timestamp || Date.now(),
      ...entry,
    };
    console.log('[Store] Adding Log Entry:', newEntry);
    set((state) => ({
      combatLog: [...state.combatLog, newEntry].slice(-100), // Keep last 100 entries
    }));
    return newEntry.id; // Return the ID for potential stream tracking
  },

  // Action to handle incoming stream chunks
  appendStreamChunk: (data) => {
    const { correlationId, type, content, cardId, playerId, complete } = data;
    const logEntryId = get().activeStreams[correlationId]?.logEntryId;

    if (!logEntryId) {
      console.warn(`[Store] Received stream chunk for unknown correlationId: ${correlationId}`);
      // Optionally, create a new log entry if the start event was missed?
      // Or just ignore it. For now, ignore.
      return;
    }

    set((state) => {
      const logIndex = state.combatLog.findIndex(entry => entry.id === logEntryId);
      if (logIndex === -1) {
        console.warn(`[Store] Log entry ${logEntryId} not found for stream chunk.`);
        return {}; // No change
      }

      const updatedLog = [...state.combatLog];
      const currentEntry = updatedLog[logIndex];

      // Append content
      const newContent = (currentEntry.content || '') + content;
      updatedLog[logIndex] = { ...currentEntry, content: newContent };

      // If stream is complete, remove from active streams
      const newActiveStreams = { ...state.activeStreams };
      if (complete) {
        console.log(`[Store] Stream complete for correlationId: ${correlationId}`);
        delete newActiveStreams[correlationId];
      }

      return { combatLog: updatedLog, activeStreams: newActiveStreams };
    });
  },

  // Action to register the start of a stream
  startStreamTracking: (correlationId, logEntryId) => {
    console.log(`[Store] Tracking stream start for correlationId: ${correlationId} -> logEntryId: ${logEntryId}`);
    set((state) => ({
      activeStreams: {
        ...state.activeStreams,
        [correlationId]: { logEntryId },
      },
    }));
  },

  // Action to handle stream errors (optional, could just log)
  handleStreamError: (data) => {
    const { correlationId, message } = data;
    console.error(`[Store] Stream error for correlationId ${correlationId}: ${message}`);
    // Maybe add an error log entry?
    get().addLogEntry({ type: 'error', content: `Stream error: ${message}` });
    // Clean up tracking
    set((state) => {
      const newActiveStreams = { ...state.activeStreams };
      delete newActiveStreams[correlationId];
      return { activeStreams: newActiveStreams };
    });
  },


  // Action to reset the store to initial state (e.g., on leaving a game)
  resetStore: () => set(initialState),

}));

// --- Selectors (Optional but recommended for performance) ---
// Example: Select only the player's hand
// export const selectPlayerHand = (state) => {
//   const player = state.gameState?.players[state.playerId];
//   return player?.hand || [];
// };

// Example: Select combat log
// export const selectCombatLog = (state) => state.combatLog;
