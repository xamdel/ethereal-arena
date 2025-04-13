import { io } from 'socket.io-client';

// Define the server URL (adjust if your server runs elsewhere)
// Use VITE_SERVER_URL environment variable if available, otherwise default
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

let socket = null;

export const connectSocket = () => {
  if (socket && socket.connected) {
    console.log('Socket already connected.');
    return socket;
  }

  console.log(`Attempting to connect to server at ${SERVER_URL}...`);
  socket = io(SERVER_URL, {
    // Optional: Add connection options here if needed
    // e.g., transports: ['websocket'],
    reconnectionAttempts: 5,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log(`Socket connected successfully: ${socket.id}`);
    // Potentially update connection status in Zustand store here
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${reason}`);
    // Potentially update connection status in Zustand store here
    if (reason === 'io server disconnect') {
      // The server intentionally disconnected the socket
      socket.connect(); // Attempt to reconnect manually if needed
    }
    // else the socket will automatically try to reconnect
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    // Potentially update connection status in Zustand store here
  });

  // --- Centralized Event Listeners (Example) ---
  // It's often better to register specific listeners where needed (e.g., in hooks or components)
  // But you could have some central listeners here if applicable.
  // Example:
  // socket.on('system-message', (data) => {
  //   console.log('System Message:', data.message);
  // });

  socket.on('error', (errorData) => {
    console.error('[Socket Error Event]:', errorData.message || errorData);
    // Handle specific errors, maybe show user feedback
  });


  return socket;
};

export const getSocket = () => {
  if (!socket) {
    console.warn('Socket not initialized. Call connectSocket first.');
    // Optionally, attempt to connect here? Or throw error?
    // return connectSocket(); // Example: auto-connect if not initialized
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    console.log('Disconnecting socket...');
    socket.disconnect();
    socket = null; // Clear the reference
  }
};

// --- Action Emitters ---
// Functions to emit actions to the server

/**
 * Emits a generic game action to the server.
 * @param {string} gameId - The ID of the game.
 * @param {object} action - The game action object (conforming to backend's GameAction type).
 * @param {boolean} [streamResponse=false] - Whether to request a streaming response (for PLAY_CARD).
 */
export const emitGameAction = (gameId, action, streamResponse = false) => {
  const currentSocket = getSocket();
  if (currentSocket && currentSocket.connected) {
    console.log(`[Socket Emit] game-action: ${action.type}`, { gameId, action, streamResponse });
    // Add correlationId if not present, for tracking responses/streams
    action.correlationId = action.correlationId || crypto.randomUUID();
    currentSocket.emit('game-action', { gameId, action, streamResponse });
    return action.correlationId; // Return ID for tracking
  } else {
    console.error('Cannot emit game-action: Socket not connected.');
    return null;
  }
};

/**
 * Emits a request to start a new game.
 * @param {string} tempGameId - A temporary client-side ID for correlation.
 * @param {string} playerId - The player's unique ID.
 * @param {string} playerName - The player's chosen name.
 * @param {boolean} isSinglePlayer - Whether to start a single-player game vs AI.
 */
export const emitStartGame = (tempGameId, playerId, playerName, isSinglePlayer) => {
  const currentSocket = getSocket();
  if (currentSocket && currentSocket.connected) {
    const correlationId = crypto.randomUUID();
    console.log('[Socket Emit] start-game', { gameId: tempGameId, playerId, playerName, isSinglePlayer, correlationId });
    currentSocket.emit('start-game', {
      gameId: tempGameId, // Send temp ID
      playerId,
      playerName,
      isSinglePlayer,
      correlationId
    });
    return correlationId;
  } else {
    console.error('Cannot emit start-game: Socket not connected.');
    return null;
  }
};

/**
 * Emits a request to join an existing game.
 * @param {string} gameId - The ID of the game to join.
 * @param {string} playerId - The player's unique ID.
 * @param {string} playerName - The player's chosen name.
 */
export const emitJoinGame = (gameId, playerId, playerName) => {
    const currentSocket = getSocket();
    if (currentSocket && currentSocket.connected) {
      const correlationId = crypto.randomUUID();
      console.log('[Socket Emit] join-game', { gameId, playerId, playerName, correlationId });
      currentSocket.emit('join-game', {
        gameId,
        playerId,
        playerName,
        correlationId
      });
      return correlationId;
    } else {
      console.error('Cannot emit join-game: Socket not connected.');
      return null;
    }
};

/**
 * Emits the selected initial cards.
 * @param {string} gameId - The actual game ID received from the server.
 * @param {string} playerId - The player's unique ID.
 * @param {string[]} selectedCardIds - Array of IDs of the selected cards.
 */
export const emitSelectCards = (gameId, playerId, selectedCardIds) => {
    const currentSocket = getSocket();
    if (currentSocket && currentSocket.connected) {
      const correlationId = crypto.randomUUID();
      console.log('[Socket Emit] select-cards', { gameId, playerId, selectedCardIds, correlationId });
      currentSocket.emit('select-cards', {
        gameId,
        playerId,
        selectedCardIds,
        correlationId
      });
      return correlationId;
    } else {
      console.error('Cannot emit select-cards: Socket not connected.');
      return null;
    }
};

/**
 * Emits a request to generate a character based on class name.
 * @param {string} className - The class name entered by the user.
 */
export const emitGenerateCharacter = (className) => {
  const currentSocket = getSocket();
  if (currentSocket && currentSocket.connected) {
    const correlationId = crypto.randomUUID(); // Optional: for tracking response if needed
    console.log('[Socket Emit] generateCharacter', { className, correlationId });
    currentSocket.emit('generateCharacter', {
      className,
      correlationId
    });
    return correlationId;
  } else {
    console.error('Cannot emit generateCharacter: Socket not connected.');
    return null;
  }
};


// --- Listener Management ---
// Functions to add/remove listeners dynamically (often used in hooks/components)

export const addSocketListener = (eventName, callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.on(eventName, callback);
  } else {
     console.error(`Cannot add listener for ${eventName}: Socket not initialized.`);
  }
};

export const removeSocketListener = (eventName, callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.off(eventName, callback);
  }
};
