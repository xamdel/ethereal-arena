import { Server, Socket } from 'socket.io';
import { generateCharacterDetails } from '../llm/character-generator'; // Import the standalone function
import { generateImage } from '../image-generation';
import {
  CharacterData,
  CharacterGenerationError,
  CharacterGenerationRequest,
  LLMCharacterOutput,
  StartingCardData,
} from '../types/character';

/**
 * Handles the 'generateCharacter' event from a client.
 * Orchestrates fetching details from the LLM, generating images (placeholder),
 * and sending the complete character data back to the client.
 *
 * @param io - The Socket.IO server instance.
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
    // 1. Get character details from LLM
    console.log(`[Socket] Calling LLM service for class: ${data.className}`);
    let llmOutput: LLMCharacterOutput;
    try {
      // Call the standalone function directly
      llmOutput = await generateCharacterDetails(data.className);
      console.log(`[Socket] Received LLM output for ${data.className}`);
    } catch (llmError) {
      console.error(`[Socket] LLM generation failed for ${data.className}:`, llmError);
      const errorPayload: CharacterGenerationError = {
        message: `Failed to generate character details from LLM: ${(llmError as Error).message}`,
        step: 'llm',
      };
      socket.emit('characterGenerationFailed', errorPayload);
      return;
    }

    // 2. Extract image prompts
    const allPrompts: { type: string; prompt: string; cardIndex?: number }[] = [
      { type: 'fullBody', prompt: llmOutput.fullBodyPrompt },
      { type: 'facialPortrait', prompt: llmOutput.facialPortraitPrompt },
      ...llmOutput.startingCards.map((card, index) => ({
        type: 'cardArt',
        prompt: card.artPrompt,
        cardIndex: index,
      })),
    ];
    console.log(`[Socket] Extracted ${allPrompts.length} image prompts.`);

    // 3. Generate images in parallel (using placeholder)
    console.log(`[Socket] Starting parallel image generation...`);
    let generatedImages: { type: string; url: string; cardIndex?: number }[];
    try {
      const imagePromises = allPrompts.map(async ({ type, prompt, cardIndex }) => {
        const url = await generateImage(prompt);
        return { type, url, cardIndex };
      });
      generatedImages = await Promise.all(imagePromises);
      console.log(`[Socket] Finished parallel image generation. Got ${generatedImages.length} images.`);
    } catch (imageError) {
      console.error(`[Socket] Image generation failed for ${data.className}:`, imageError);
      const errorPayload: CharacterGenerationError = {
        message: `Failed during image generation: ${(imageError as Error).message}`,
        step: 'image-generation',
      };
      socket.emit('characterGenerationFailed', errorPayload);
      return;
    }

    // 4. Construct final CharacterData payload
    const fullBodyImage = generatedImages.find(img => img.type === 'fullBody');
    const facialPortraitImage = generatedImages.find(img => img.type === 'facialPortrait');
    const cardImages = generatedImages.filter(img => img.type === 'cardArt');

    // Ensure all required images were generated
    if (!fullBodyImage || !facialPortraitImage || cardImages.length !== llmOutput.startingCards.length) {
        console.error(`[Socket] Mismatch in generated images. Expected full body, facial, and ${llmOutput.startingCards.length} card arts. Got:`, generatedImages);
        throw new Error('Image generation did not produce all required images.');
    }

    const finalCharacterData: CharacterData = {
      className: data.className,
      descriptionAndBackstory: llmOutput.descriptionAndBackstory,
      classFeatures: llmOutput.classFeatures,
      fullBodyImageUrl: fullBodyImage.url,
      facialPortraitImageUrl: facialPortraitImage.url,
      startingCards: llmOutput.startingCards.map((card, index) => {
        const correspondingImage = cardImages.find(img => img.cardIndex === index);
        if (!correspondingImage) {
            // This should theoretically not happen due to the check above, but belts and suspenders
            console.error(`[Socket] Could not find generated image for card index ${index}`);
            throw new Error(`Missing generated image for starting card at index ${index}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { artPrompt, ...restOfCard } = card; // Omit artPrompt
        return {
          ...restOfCard,
          artUrl: correspondingImage.url, // Add artUrl
        };
      }),
    };

    // 5. Emit result to the client
    console.log(`[Socket] Sending characterGenerated event to socket ${socket.id} for class ${data.className}`);
    socket.emit('characterGenerated', finalCharacterData);

  } catch (error) {
    console.error(`[Socket] Unexpected error during character generation for ${data.className}:`, error);
    const errorPayload: CharacterGenerationError = {
      message: `An unexpected error occurred: ${(error as Error).message}`,
      step: 'unknown',
    };
    socket.emit('characterGenerationFailed', errorPayload);
  }
}
