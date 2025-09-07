/**
 * Represents the data structure for a single starting card.
 */
export interface StartingCardData {
  artPrompt: string; // Prompt for generating the card's artwork
  abilityName: string; // The name of the card's ability
  effects: string; // Description of the card's effects in the game
  flavorText: string; // Flavor text for the card
  cost: number; // The energy cost to play the card (0-5)
}

/**
 * Represents the structured output expected from the LLM after generating character details.
 */
export interface LLMCharacterOutput {
  fullBodyPrompt: string; // Prompt for the full-body character image + background
  // facialPortraitPrompt: string; // Removed: Prompt for the character's facial portrait
  descriptionAndBackstory: string; // Paragraph describing the character
  classFeatures: string[]; // Array of 3 strings detailing class features/playstyle
  startingCards: StartingCardData[]; // Array of starting cards (typically 3-5)
}

/**
 * Represents the request sent from the client to the server to initiate character generation.
 */
export interface CharacterGenerationRequest {
  className: string; // The class name input by the user
}

/**
 * Represents the final character data sent from the server to the client,
 * including generated text and image URLs.
 */
export interface CharacterData extends Omit<LLMCharacterOutput, 'fullBodyPrompt' | 'startingCards'> { // Removed facialPortraitPrompt from Omit
  className: string; // The class name used for generation
  fullBodyImageUrl: string; // URL of the generated full-body image
  // facialPortraitImageUrl: string; // Removed: URL of the generated facial portrait image
  // Starting cards with art URLs instead of prompts; includes cost property inherited from StartingCardData via Omit
  startingCards: (Omit<StartingCardData, 'artPrompt'> & { artUrl: string })[];
}

/**
 * Represents an error during character generation.
 */
export interface CharacterGenerationError {
  message: string; // Error message describing the failure
  step?: 'llm' | 'image-generation' | 'unknown'; // Optional: indicates which step failed
}
