import { LLMCharacterOutput, StartingCardData } from '../types/character'; // Import StartingCardData too
import { llmClient } from './api-client'; // Adjusted import path
// Assuming JsonSchemaResponseFormat is exported from api-client.ts or defined elsewhere
// If not, we'd need to define it here or import it properly.
// For now, let's assume it's available via llmClient or similar context.

// Define the JSON Schema for the expected output
const characterOutputSchema = {
  name: 'character_details', // Name for the schema
  strict: true, // Enforce strict adherence
  schema: {
    type: 'object',
    properties: {
      fullBodyPrompt: {
        type: 'string',
        description: 'Detailed visual description of the character\'s full body appearance and background environment, suitable for text-to-image generation.',
      },
      facialPortraitPrompt: {
        type: 'string',
        description: 'Detailed visual description focusing on the character\'s face and expression, suitable for a portrait text-to-image generation. Must be visually consistent with the full body prompt.',
      },
      descriptionAndBackstory: {
        type: 'string',
        description: 'A short, generic paragraph describing the class archetype, origins, and motivations. Avoid specific names or detailed personal histories.',
      },
      classFeatures: {
        type: 'array',
        description: 'Exactly three unique features defining the class\'s high-level playstyle. Each feature should be a single, concise sentence.',
        items: {
          type: 'string',
          description: 'A single, concise sentence describing a class feature and its impact on playstyle.',
        },
        minItems: 3,
        maxItems: 3,
      },
      startingCards: {
        type: 'array',
        description: 'Exactly six starting cards representing the class\'s initial abilities.',
        items: {
          type: 'object',
          properties: {
            artPrompt: {
              type: 'string',
              description: 'Detailed visual prompt for the card\'s artwork. If the character is depicted, ensure visual consistency with full body/portrait prompts.',
            },
            abilityName: {
              type: 'string',
              description: 'The name of the card\'s ability.',
            },
            effects: {
              type: 'string',
              description: 'Description of the card\'s effects in the game.',
            },
            flavorText: {
              type: 'string',
              description: 'Flavor text adding personality to the card.',
            },
            cost: {
              type: 'integer',
              description: 'The energy cost to play the card (0-5). Guideline: 1 energy ≈ 5 points damage/healing/block.',
              minimum: 0,
              maximum: 5,
            },
          },
          required: ['artPrompt', 'abilityName', 'effects', 'flavorText', 'cost'],
          additionalProperties: false,
        },
        minItems: 6,
        maxItems: 6,
      },
    },
    required: [
      'fullBodyPrompt',
      'facialPortraitPrompt',
      'descriptionAndBackstory',
      'classFeatures',
      'startingCards',
    ],
    additionalProperties: false,
  },
};


/**
 * Generate character details using the LLM based on a class name.
 * @param className - The class name provided by the user.
 * @returns A promise that resolves with the structured character details.
 */
export async function generateCharacterDetails(className: string): Promise<LLMCharacterOutput> {
  console.log(`[CharacterGenerator] Generating character details for class: ${className}`);

  // Updated system prompt focusing on content generation, assuming structure is handled by the API
  const systemPrompt = `You are a creative assistant specializing in fantasy character class concepts for a card game. Generate detailed and evocative content for the requested class archetype, adhering strictly to the required JSON schema fields.
Key Instructions:
1.  **Visual Consistency:** Ensure all visual descriptors (hair color, clothing, key features, etc.) are identical across 'fullBodyPrompt', 'facialPortraitPrompt', and any 'artPrompt' for cards depicting the character. The image generation models do not share context between prompts.
2.  **Class Focus, Not Character:** Generate a description for a class archetype, not a specific named character. Keep 'descriptionAndBackstory' short, generic, and focused on the class identity/origins. Do NOT invent a name for the character/class.
3.  **Concise Class Features:** 'classFeatures' must be exactly 3 short, single sentences describing the high-level playstyle or unique mechanics of the class.
4.  **Starting Cards:** Generate exactly 6 'startingCards', each including a 'cost' between 0 and 5.
5.  **Adhere to Schema:** Strictly follow the provided JSON schema structure and types for all fields.`;

  const userPrompt = `Generate a complete character class concept for the archetype "${className}". Provide creative details for all required fields: full body visual prompt, facial portrait visual prompt, generic class description/backstory, exactly 3 concise class features (playstyle-focused), and exactly 6 starting cards (including art prompt, ability name, effects, flavor text, and cost [0-5] for each card). Ensure visual prompts are detailed, consistent, and suitable for high-quality image generation. Do not name the character class.`;

  // Construct the response_format object for the API call
  const responseFormat = {
    type: 'json_schema' as const, // Use 'as const' for literal type
    json_schema: characterOutputSchema,
  };

  try {
    const response = await llmClient.complete(userPrompt, {
      systemPrompt,
      temperature: 0.8, // Slightly higher temperature for creativity
      response_format: responseFormat, // Pass the structured output format
      // Consider adjusting maxTokens if needed, though structured output might manage this
    });

    console.log(`[CharacterGenerator] Received LLM response content: ${response.content.substring(0, 100)}...`);

    // Attempt to parse the JSON response (assuming API still returns stringified JSON in content)
    // If the API directly returns a parsed object in a different field, adjust this.
    try {
      // No need to clean markdown backticks if structured output works correctly
      const characterDetails = JSON.parse(response.content) as LLMCharacterOutput;

      // Basic validation (remains important)
      if (
        typeof characterDetails.fullBodyPrompt !== 'string' || !characterDetails.fullBodyPrompt ||
        typeof characterDetails.facialPortraitPrompt !== 'string' || !characterDetails.facialPortraitPrompt ||
        typeof characterDetails.descriptionAndBackstory !== 'string' || !characterDetails.descriptionAndBackstory ||
        !Array.isArray(characterDetails.classFeatures) || characterDetails.classFeatures.length !== 3 || !characterDetails.classFeatures.every(f => typeof f === 'string' && f.length > 0) || // Ensure features are non-empty strings
        !Array.isArray(characterDetails.startingCards) || characterDetails.startingCards.length !== 6 || // Check for 6 cards
        !characterDetails.startingCards.every((card: StartingCardData) => // Add type annotation
          typeof card.artPrompt === 'string' && card.artPrompt &&
          typeof card.abilityName === 'string' && card.abilityName &&
          typeof card.effects === 'string' && card.effects &&
          typeof card.flavorText === 'string' && card.flavorText &&
          typeof card.cost === 'number' && Number.isInteger(card.cost) && card.cost >= 0 && card.cost <= 5 // Validate cost
        )
      ) {
        console.error('[CharacterGenerator] Validation failed. LLM output:', JSON.stringify(characterDetails, null, 2));
        throw new Error('LLM output validation failed. Structure or content mismatch.');
      }

      console.log('[CharacterGenerator] Successfully parsed and validated character details from LLM response.');
      return characterDetails;
    } catch (parseError) {
      console.error(`[CharacterGenerator] Failed to parse LLM response as JSON: ${(parseError as Error).message}`);
      console.error(`[CharacterGenerator] Raw LLM response: ${response.content}`);
      throw new Error(`Failed to parse character details from LLM. Raw response: ${response.content}`);
    }
  } catch (error) {
    console.error(`[CharacterGenerator] Error generating character details from LLM: ${(error as Error).message}`);
    throw error; // Re-throw the error to be handled by the caller
  }
}
