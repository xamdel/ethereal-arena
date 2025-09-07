export const characterSchema = {
  name: 'character_details', // Name for the schema
  strict: true, // Enforce strict adherence
  schema: {
    type: 'object',
    properties: {
      fullBodyPrompt: {
        type: 'string',
        description: 'Detailed visual description of the character\'s full body appearance and background environment, suitable for text-to-image generation. The character\'s action pose and background scene should be thematic for their class',
      },
      // facialPortraitPrompt removed
      descriptionAndBackstory: {
        type: 'string',
        description: 'A short, generic paragraph describing the class archetype, origins, and motivations. Avoid specific names or detailed personal histories.',
      },
      classFeatures: {
        type: 'array',
        description: 'Exactly three unique features defining the class\'s high-level playstyle. Each feature should be a single, concise sentence.',
        items: {
          type: 'string',
          description: 'A single, concise sentence describing a class playstyle mechanic.',
        },
        minItems: 3,
        maxItems: 3,
      },
      startingCards: {
        type: 'array',
        description: 'Exactly six starting cards representing the class\'s initial abilities, consistent with class theme and features.',
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
      // 'facialPortraitPrompt' removed
      'descriptionAndBackstory',
      'classFeatures',
      'startingCards',
    ],
    additionalProperties: false,
  },
};