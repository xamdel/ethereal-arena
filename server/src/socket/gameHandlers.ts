/**
 * Socket Handlers for Game Actions and Events
 */
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameAction, ActionType } from '../types'; // Assuming ActionType is in types
import {
  getGameSession,
  processAction,
  startGame,
  createGameSession
} from '../game-engine/game-session-manager';
import { llmService } from '../game-engine/llm-service'; // For streaming
import { calculateCardEnergyCost, clearCardEnergyCostCache } from '../llm'; // For cost calculation

export function registerGameHandlers(io: SocketIOServer, socket: Socket): void {

  // Handle create and start game request
  socket.on('start-game', async (data) => {
    const { gameId, playerId, playerName = 'Player', isSinglePlayer = true, correlationId } = data;

    if (!gameId || !playerId) {
      socket.emit('error', { message: 'Game ID and Player ID are required' });
      return;
    }

    try {
      console.log(`[Socket.IO] Creating and starting game for player ${playerId} (${playerName})`);

      // Create a new game session using the game engine
      const gameSession = createGameSession(playerId, playerName, isSinglePlayer);

      // Join the socket to the game room with the server-generated game ID
      const actualGameId = gameSession.id;
      socket.join(actualGameId);
      socket.data.gameId = actualGameId; // Store actual game ID
      socket.data.playerId = playerId;

      console.log(`[Socket.IO] Game created with ID: ${actualGameId} (replacing temp ID: ${gameId}), now starting...`);

      // Start the game using the imported startGame function
      const startedSession = await startGame(actualGameId);

      if (!startedSession) {
        console.error(`[Socket.IO] Failed to start game ${actualGameId}`);
        socket.emit('error', { message: 'Failed to start game' });
        return;
      }

      console.log(`[Socket.IO] Game ${actualGameId} started successfully`);
      // Broadcast the game start and updated state
      io.to(actualGameId).emit('game-started', {
        gameState: startedSession.gameState,
        correlationId: correlationId
      });
    } catch (error) {
      console.error(`[Socket.IO] Error creating/starting game:`, error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error creating/starting game'
      });
    }
  });

  // Handle select cards request
  socket.on('select-cards', async (data) => {
    const { gameId, playerId, selectedCardIds, correlationId } = data;

    if (!gameId || !playerId || !selectedCardIds) {
      socket.emit('error', { message: 'Invalid card selection data' });
      return;
    }

    try {
      // Get the actual game ID from socket data if available
      const actualGameId = socket.data.gameId || gameId;

      if (actualGameId !== gameId) {
        console.log(`[Socket.IO] Using actual game ID ${actualGameId} instead of provided ID ${gameId}`);
      }

      console.log(`[Socket.IO] Selecting cards for player ${playerId} in game ${actualGameId}`);

      // Create a select cards action
      const selectAction: GameAction = {
        id: uuidv4(),
        type: ActionType.SELECT_CARDS, // Use ActionType enum
        playerId: playerId,
        payload: { selectedCardIds },
        timestamp: Date.now(),
        gameId: actualGameId,
        validated: false, // Validation happens in reducer/manager
        correlationId: correlationId
      };

      // Process the action
      console.log(`[Socket.IO] Processing select cards action`);
      const result = await processAction(actualGameId, selectAction);

      if (!result.session) {
        console.error(`[Socket.IO] Error selecting cards: ${result.error}`);
        socket.emit('error', {
          message: result.error || 'Failed to select cards'
        });
        return;
      }
      console.log(`[Socket.IO] Cards selected successfully, broadcasting update`);

      // Broadcast the updated game state (using the actual game ID)
      io.to(actualGameId).emit('game-state-update', {
        gameState: result.session.gameState,
        action: selectAction,
        correlationId: correlationId
      });
    } catch (error) {
      console.error(`[Socket.IO] Error selecting cards:`, error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error selecting cards'
      });
    }
  });

  // Handle game actions
  socket.on('game-action', async (data) => {
    const { gameId, action, streamResponse } = data; // streamResponse is top-level flag

    if (!gameId || !action || !action.type || !action.playerId) {
      socket.emit('error', { message: 'Invalid action data' });
      return;
    }

    // Ensure action has an ID and timestamp if missing
    action.id = action.id || uuidv4();
    action.timestamp = action.timestamp || Date.now();
    action.gameId = gameId; // Ensure gameId is on the action itself

    // Determine if streaming is requested (check both top-level and payload)
    const useStreaming = streamResponse === true || action.payload?.streamResponse === true;

    try {
      console.log(`[Socket.IO] Received ${action.type} action for game ${gameId} (Streaming: ${useStreaming})`);

      // --- Action-Specific Handling ---

      if (action.type === ActionType.CALCULATE_CARD_COST) {
        await handleCardCostCalculation(socket, gameId, action);
      }
      else if (action.type === ActionType.CLEAR_CARD_COST_CACHE) {
        await handleClearCardCostCache(socket, gameId, action);
      }
      else if (action.type === ActionType.PLAY_CARD && useStreaming) {
        // Handle streaming card play separately
        await handleStreamingCardPlay(io, socket, gameId, action);
      }
      else {
        // --- Default Action Processing ---
        console.log(`[Socket.IO] Processing action normally: ${action.type}`);
        const result = await processAction(gameId, action);

        if (!result.session) {
          console.error(`[Socket.IO] Error processing action ${action.type}: ${result.error}`);
          socket.emit('error', {
            message: result.error || `Failed to process ${action.type} action`
          });
          return;
        }

        console.log(`[Socket.IO] Action ${action.type} processed successfully, broadcasting update`);

        // Broadcast the updated game state to all clients in the room
        io.to(gameId).emit('game-state-update', {
          gameState: result.session.gameState,
          action: action, // Include the action that triggered the update
          correlationId: action.correlationId
        });
      }
    } catch (error) {
      console.error(`[Socket.IO] Error processing action ${action.type}:`, error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : `Unknown error processing ${action.type} action`
      });
    }
  });
}

// --- Helper Functions (Moved from index.ts) ---

async function handleCardCostCalculation(socket: Socket, gameId: string, action: GameAction) {
  try {
    console.log(`[Socket.IO] Calculating card cost for game ${gameId}, card ${action.payload.cardId}`);

    const session = getGameSession(gameId);
    if (!session) {
      throw new Error('Game session not found');
    }

    const playerId = action.playerId;
    const cardId = action.payload.cardId;

    const player = session.gameState.players[playerId];
    if (!player) {
      throw new Error('Player not found in game session');
    }

    const card = player.hand.find(c => c.id === cardId);
    if (!card) {
      throw new Error('Card not found in player\'s hand');
    }

    // Convert game state to format for LLM
    const llmGameState = {
      players: Object.entries(session.gameState.players).reduce((acc, [id, p]) => {
        acc[id] = {
          id,
          hp: p.hp,
          maxHp: p.maxHp,
          block: p.block,
          energy: p.energy,
          statusEffects: p.statusEffects || []
        };
        return acc;
      }, {} as any),
      activePlayerId: session.gameState.activePlayerId,
      turn: session.gameState.turnNumber,
      phase: session.gameState.phase
    };

    console.log(`[Socket.IO] Calling calculateCardEnergyCost for card ${card.name}`);
    const costResult = await calculateCardEnergyCost(card, playerId, llmGameState);

    console.log(`[Socket.IO] Card ${card.name} costs ${costResult.energyCost} energy (${costResult.canPlay ? 'can play' : 'cannot play'}): ${costResult.reason}`);

    // Send the cost calculation result back only to the requesting client
    socket.emit('action-received', { // Use a consistent event name? Maybe 'cost-calculated'?
      canPlay: costResult.canPlay,
      energyCost: costResult.energyCost,
      reason: costResult.reason,
      cardId: cardId,
      correlationId: action.correlationId
    });

  } catch (error) {
    console.error(`[Socket.IO] Error calculating card cost:`, error);
    socket.emit('error', {
      message: error instanceof Error ? error.message : 'Unknown error calculating card cost'
    });
  }
}

async function handleClearCardCostCache(socket: Socket, gameId: string, action: GameAction) {
  try {
    console.log(`[Socket.IO] Clearing card cost cache for game ${gameId}`);

    // Get the game session to ensure it exists (optional, could just clear globally)
    const session = getGameSession(gameId);
    if (!session) {
      throw new Error('Game session not found');
    }

    // Clear the cache (assuming it's global or per-player based on implementation)
    // If cache is per-player, need playerId from action
    await clearCardEnergyCostCache(action.playerId); // Assuming per-player cache

    console.log(`[Socket.IO] Card cost cache cleared for game ${gameId}`);

    // Send success response
    socket.emit('action-received', { // Use a consistent event name? Maybe 'cache-cleared'?
      success: true,
      message: 'Card cost cache cleared',
      correlationId: action.correlationId
    });

  } catch (error) {
    console.error(`[Socket.IO] Error clearing card cost cache:`, error);
    socket.emit('error', {
      message: error instanceof Error ? error.message : 'Unknown error clearing card cost cache'
    });
  }
}

async function handleStreamingCardPlay(io: SocketIOServer, socket: Socket, gameId: string, action: GameAction) {
  const { cardId, targetId } = action.payload;
  const playerId = action.playerId;

  try {
    console.log(`[Socket.IO] Handling streaming card play for game ${gameId}, card ${cardId}`);

    const session = getGameSession(gameId);
    if (!session) {
      throw new Error('Game session not found');
    }

    const player = session.gameState.players[playerId];
    if (!player) {
      throw new Error('Player not found in game session');
    }

    // Find the card (handle potential missing card as before)
    let card = player.hand.find(c => c.id === cardId);
    if (!card) {
      console.warn(`[Socket.IO] Card ${cardId} not found in player's hand. Checking discard/deck...`);
      card = player.discard?.find(c => c.id === cardId) ?? player.deck?.find(c => c.id === cardId);
      if (!card) {
         // Create a dummy card if still not found
         console.log(`[Socket.IO] Creating dummy card for streaming`);
         card = {
           id: cardId,
           name: "Unknown Card (Stream Fallback)",
           description: "Details missing", cost: 0, base_effects: "", art_prompt: "", createdAt: 0, createdBy: ""
         };
      }
    }
     if (!card) { // Final check after fallback
        throw new Error(`Card ${cardId} not found for streaming`);
     }


    console.log(`[Socket.IO] Streaming card "${card.name}" (${cardId}) for player ${playerId}`);

    // Emit immediate on_play_description if available
    if (card?.on_play_description) {
      let description = card.on_play_description
        .replace(/\[player\]/g, player.name || 'You')
        .replace(/\[opponent\]/g, Object.values(session.gameState.players).find(p => p.id !== playerId)?.name || 'opponent');
      console.log(`[Socket.IO] Sending immediate on_play_description: "${description}"`);
      io.to(gameId).emit('llm-stream-chunk', { type: 'on-play-description', content: description, cardId, playerId });
    }

    // Create the stream using the LLM service
    console.log(`[Socket.IO] Creating card effects stream via llmService`);
    // Convert game state to the format expected by the LLM service
    const llmGameState = {
        players: Object.entries(session.gameState.players).reduce((acc, [id, p]) => {
          acc[id] = {
            id,
            hp: p.hp,
            maxHp: p.maxHp,
            block: p.block,
            energy: p.energy,
            statusEffects: p.statusEffects || []
          };
          return acc;
        }, {} as any),
        activePlayerId: session.gameState.activePlayerId,
        turn: session.gameState.turnNumber, // Map turnNumber to turn
        phase: session.gameState.phase,
        targetId // Include targetId if provided
      };

    const stream = await llmService.createCardEffectsStream(
      card,
      playerId,
      llmGameState, // Pass the correctly formatted state
      gameId,
      targetId // targetId is already included in llmGameState, but passing here might be redundant/harmless depending on llmService implementation
    );

    console.log(`[Socket.IO] Stream created, emitting stream-start`);
    io.to(gameId).emit('llm-stream-start', { cardId, playerId, timestamp: Date.now() });

    // Stream chunks to the client
    let chunkCount = 0;
    try {
      console.log(`[Socket.IO] Processing stream chunks...`);
      for await (const chunk of stream) {
        chunkCount++;
        // Handle new EffectInterpretationStreamEvent format
        if (chunk.type && chunk.content) {
          io.to(gameId).emit('llm-stream-chunk', {
            type: chunk.type,
            content: chunk.content,
            cardId,
            playerId,
            complete: chunk.complete // Pass complete flag if present
          });
        }
        // Removed backward compatibility check for old stream format (chunk.choices)
        // The stream should now only yield EffectInterpretationStreamEvent objects.
        if (chunkCount % 10 === 0) console.log(`[Socket.IO] Processed ${chunkCount} stream chunks`);
      }
      console.log(`[Socket.IO] Stream completed with ${chunkCount} total chunks`);
    } catch (streamError) {
      console.error(`[Socket.IO] Error streaming chunks:`, streamError);
      io.to(gameId).emit('llm-stream-error', {
        message: streamError instanceof Error ? streamError.message : 'Unknown streaming error',
        cardId, playerId
      });
    }

    // Signal end of stream
    console.log(`[Socket.IO] Emitting stream-end event with correlationId: ${action.correlationId}`);
    io.to(gameId).emit('llm-stream-end', {
      cardId,
      playerId,
      timestamp: Date.now(),
      correlationId: action.correlationId // Crucial for resolving client-side promise
    });

    // Process the card play action normally AFTER streaming is done
    console.log(`[Socket.IO] Stream ended, processing PLAY_CARD action normally`);
    // Ensure the action payload doesn't re-trigger streaming in processAction
    const nonStreamingAction = {
      ...action,
      payload: { ...action.payload, streamResponse: false }
    };
    const result = await processAction(gameId, nonStreamingAction);

    if (!result.session) {
      console.error(`[Socket.IO] Error processing action after stream: ${result.error}`);
      // Don't emit socket error here, stream-end should signal completion/failure
      return; // Avoid broadcasting potentially incorrect state
    }

    console.log(`[Socket.IO] Card play processed post-stream, broadcasting final game state`);
    // Broadcast the final game state update
    io.to(gameId).emit('game-state-update', {
      gameState: result.session.gameState,
      action: action, // Send original action for context
      correlationId: action.correlationId
    });

  } catch (error) {
    console.error(`[Socket.IO] Error in streaming card play handler:`, error);
    socket.emit('error', {
      message: error instanceof Error ? error.message : 'Unknown error in streaming card play'
    });
    // Signal stream error to client if possible
    io.to(gameId).emit('llm-stream-error', {
      message: error instanceof Error ? error.message : 'Unknown error during streaming setup',
      cardId: cardId,
      playerId: playerId
    });
  }
}
