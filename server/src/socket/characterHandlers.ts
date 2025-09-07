import { Server, Socket } from 'socket.io';
import { generateCharacterDetails } from '../llm/character-generator'; // Import the updated function
import {
  CharacterData,
  CharacterGenerationError,
  CharacterGenerationRequest,
  // LLMCharacterOutput and StartingCardData might no longer be needed here
} from '../types/character';

/**
 * Handles the 'generateCharacter' event from a client.
 * Calls the character generation service which handles LLM interaction and image generation,
 * then sends the complete character data or an error back to the client.
 *
 * @param io - The Socket.IO server instance. (Currently unused, but kept for potential future use)
 * @param socket - The socket instance for the requesting client.
 * @param data - The request data containing the className.
 */
export async function handleGenerateCharacter(
  io: Server,
  socket: Socket,
  data: CharacterGenerationRequest
): Promise<void> {
  console.log(`[Socket] Received generateCharacter request for class: ${data.className} from socket ${socket.id}`);

  try {
    // 1. Call the unified character generation function
    console.log(`[Socket] Calling character generation service for class: ${data.className}`);
    const characterData: CharacterData = await generateCharacterDetails(data.className);
    console.log(`[Socket] Successfully generated character data for ${data.className}`);

    // 2. Emit result to the client
    console.log(`[Socket] Sending characterGenerated event to socket ${socket.id} for class ${data.className}`);
    socket.emit('characterGenerated', characterData);

  } catch (error) {
    // Handle errors from either LLM or image generation steps
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    // Check if the error object has our custom 'step' property
    const errorStep = (error as any)?.step || 'unknown'; // Default to 'unknown' if step is not defined

    console.error(`[Socket] Character generation failed for ${data.className} at step '${errorStep}':`, error);

    const errorPayload: CharacterGenerationError = {
      message: `Character generation failed: ${errorMessage}`,
      step: errorStep,
    };
    socket.emit('characterGenerationFailed', errorPayload);
  }
}
