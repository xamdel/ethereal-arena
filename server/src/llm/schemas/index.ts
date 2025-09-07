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
      },
      startingCards: {
        type: 'array',
        description: 'Exactly six starting cards representing the class\'s initial abilities, consistent with class theme and features. Each card must have: artPrompt (string), abilityName (string), effects (string), flavorText (string), cost (integer 0-5).',
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