import { fal } from "@fal-ai/client";

// Initialize fal.ai client
// By default, it reads the FAL_API_KEY from process.env
// Ensure your .env file in the server/ directory has FAL_API_KEY=your_key:your_secret
fal.config({ credentials: process.env.FAL_API_KEY }); // Explicitly configure credentials

/**
 * Generates an image from a text prompt using the fal.ai HiDream model.
 *
 * Generates an image from a text prompt using a specified fal.ai model and image size.
 *
 * @param prompt - The text prompt describing the desired image.
 * @param modelName - The identifier of the fal.ai model to use (e.g., 'fal-ai/hidream-i1-dev', 'fal-ai/sana/sprint').
 * @param imageSize - The desired image size (e.g., 'square', 'landscape_16_9', or { width: number, height: number }).
 * @returns A promise that resolves with the generated image URL.
 * @throws Throws an error if the API call fails or returns an unexpected format.
 */
export async function generateImage(
  prompt: string,
  modelName: string,
  imageSize: string | { width: number; height: number }
): Promise<string> {
  console.log(`[Image Generation] Received prompt: "${prompt}" for model ${modelName} with size ${JSON.stringify(imageSize)}`);

  try {
    // Construct the input object, including the image_size
    const input: { prompt: string; image_size: string | { width: number; height: number }; [key: string]: any } = {
      prompt: prompt,
      image_size: imageSize,
      sync_mode: true,
      acceleration: 'high',
      // Add other common parameters if needed, or they can be passed dynamically
    };

    console.log(`[Image Generation] Calling model: ${modelName} with input:`, input);

    const result: any = await fal.subscribe(modelName, {
      input: input,
      // logs: true, // Disabled for cleaner console output
      // onQueueUpdate(update) {
      //   console.log('[Image Generation] Queue update:', update);
      // }, // Disabled for cleaner console output
    });

    // The new client returns { data, requestId }
    console.log('[Image Generation] API Result Data:', result.data);
    console.log('[Image Generation] Request ID:', result.requestId);

    // Access images via result.data.images
    // Adjust this based on the actual response structure from fal.ai
    if (result?.data?.images && result.data.images.length > 0 && result.data.images[0].url) {
      const imageUrl = result.data.images[0].url;
      console.log(`[Image Generation] Returning URL: ${imageUrl}`);
      return imageUrl;
    } else {
      console.error('[Image Generation] Unexpected API response format:', result.data);
      throw new Error('Failed to generate image: Unexpected API response format.');
    }
  } catch (error) {
    console.error('[Image Generation] Error calling fal.ai API:', error);
    // Re-throw the error to be handled by the caller
    throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
  }
}
