# LLM Integration for Ethereal Arena

This module provides LLM integration for the Ethereal Arena card game, handling card generation, effect interpretation (including streaming), and energy cost calculation.

## Setup

1.  Install dependencies:
    ```bash
    npm install dotenv openai
    # uuid is likely used elsewhere in the project
    ```

2.  Create a `.env` file in the `server` directory (or project root, depending on where `dotenv.config()` is called) with your OpenRouter API key:
    ```
    OPENROUTER_API_KEY=your_openrouter_api_key_here
    ```

## Module Structure

-   `api-client.ts`: Base LLM client using the `openai` SDK structure to make API calls to OpenRouter. Handles retries and errors.
-   `card-generator.ts`: Generates contextual cards based on game state using the LLM.
-   `effect-interpreter.ts`: Interprets card effects in the context of the current game state using the LLM. Provides both standard and streaming interpretation, plus energy cost calculation with caching.
-   `example-usage.ts`: Example script demonstrating module usage (ensure this is not included in production builds).
-   `index.ts`: Main export file, providing convenience functions.

## Usage (`index.ts` convenience functions)

### Card Generation

```typescript
import { generateCards } from './llm';

// Generate 5 cards with player context
const cards = await generateCards(5, {
  hp: 45,
  maxHp: 80,
  block: 0,
  energy: 3,
  statusEffects: [
    { name: 'Vulnerable', description: 'Takes 50% more damage', duration: 2 }
  ]
});
```

### Card Energy Cost Calculation

```typescript
import { calculateCardEnergyCost, clearCardEnergyCostCache } from './llm';

// Calculate cost (uses cache if available)
const costResult = await calculateCardEnergyCost(
  card,       // Card object
  playerId,   // Player ID
  llmGameState // Game state in LLMGameState format
);
console.log(`Cost: ${costResult.energyCost}, Can Play: ${costResult.canPlay}, Reason: ${costResult.reason}`);

// Clear cache for a player when state changes significantly
await clearCardEnergyCostCache(playerId);
```

### Effect Interpretation (Standard)

```typescript
import { interpretCardEffects } from './llm';

// Interpret a card's effects
const interpretation = await interpretCardEffects(
  card,       // Card object
  playerId,   // Player ID
  llmGameState // Game state in LLMGameState format (can include targetId)
);

// Use the interpretation
console.log('Narrative:', interpretation.narrative);
console.log('Can Play:', interpretation.canPlayCard);
interpretation.stateChanges.forEach(change => {
  console.log(`- Action: ${change.action}, Target: ${change.target}, Value: ${change.value}`);
  console.log(`  Narration: ${change.narration}`);
  // Process state change...
});
```

### Effect Interpretation (Streaming)

```typescript
import { streamCardEffects, EffectInterpretationStreamEvent } from './llm';

const stream = streamCardEffects(
  card,       // Card object
  playerId,   // Player ID
  llmGameState // Game state in LLMGameState format (can include targetId)
);

try {
  for await (const event of stream) {
    console.log(`Stream Event Type: ${event.type}, Content: ${event.content}`);
    if (event.type === 'narrative') {
      // Update overall narrative display
    } else if (event.type === 'effect') {
      // Display individual effect narration
    } else if (event.type === 'error') {
      console.error('Stream Error:', event.content);
    }

    if (event.complete) {
      console.log('Stream finished.');
      // Final state update likely triggered separately after stream ends
    }
  }
} catch (error) {
  console.error('Error processing stream:', error);
}
```

## Integration with Game Engine

The `llm-service.ts` file in the `game-engine` directory provides a service layer for integrating LLM functionality. It uses the `mapToLLMGameState` utility function to convert the engine's `GameState` to the `LLMGameState` format required by this module.

```typescript
import { llmService, mapToLLMGameState } from './game-engine/llm-service';

// Convert state before calling LLM functions via the service
const llmState = mapToLLMGameState(currentGameState, optionalTargetId);

// Generate cards for a player
const cards = await llmService.generateCardsForPlayer(playerId, llmState, 5);

// Interpret card effects
const effects = await llmService.interpretCardEffects(card, playerId, llmState);

// Create interpretation stream
const stream = await llmService.createCardEffectsStream(card, playerId, llmState, gameId);

// Calculate cost
const cost = await llmService.calculateCardEnergyCost(card, playerId, llmState);
```

## Architecture

1.  **LLM Client Layer (`api-client.ts`)**: Handles API calls to OpenRouter using the `openai` SDK structure, manages authentication, retries, and error handling.
2.  **Card Generation Layer (`card-generator.ts`)**: Creates prompts and parses responses for generating contextual cards.
3.  **Effect Interpretation Layer (`effect-interpreter.ts`)**: Creates prompts and parses responses for interpreting card effects, calculating costs, and handling streaming output. Includes cost caching.
4.  **Game Engine Integration (`game-engine/llm-service.ts`)**: Provides an abstraction layer for the game engine to interact with LLM capabilities, including state format conversion.

## Error Handling

The LLM client includes robust error handling:
-   Rate limit detection (429)
-   Server error detection (5xx)
-   Authentication error detection (401, 403)
-   Retry logic for transient failures (rate limits, server errors)
-   Normalization of errors into `LLMAPIError` type.
-   Detailed error logging.
