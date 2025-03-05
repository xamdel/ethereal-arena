# LLM Integration for Ethereal Arena

This module provides LLM integration for the Ethereal Arena card game, handling both card generation and effect interpretation.

## Setup

1. Install dependencies:
```bash
npm install dotenv @anthropic-ai/sdk uuid
```

2. Create a `.env` file in the project root with your API key:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## Module Structure

- `api-client.ts`: Base LLM client for making API calls to Anthropic Claude
- `card-generator.ts`: Generates contextual cards based on game state
- `effect-interpreter.ts`: Interprets card effects in the context of current game state
- `example-usage.ts`: Example of how to use the integration
- `index.ts`: Main export file

## Usage

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
    {
      name: 'Vulnerable',
      description: 'Takes 50% more damage from attacks',
      duration: 2
    }
  ]
});
```

### Effect Interpretation

```typescript
import { interpretCardEffects } from './llm';

// Interpret a card's effects
const interpretation = await interpretCardEffects(
  card,           // Card object
  'player1',      // Player ID
  gameState       // Current game state
);

// Use the interpretation
console.log(interpretation.narrative);
interpretation.baseEffects.forEach(effect => {
  // Process base effects
});
interpretation.wildcardEffects.forEach(effect => {
  // Process wildcard effects
});
```

## Integration with Game Engine

The `llm-service.ts` file in the game-engine directory provides a service for integrating LLM functionality with the game engine.

```typescript
import { llmService } from './game-engine/llm-service';

// Generate cards for a player
const cards = await llmService.generateCardsForPlayer(
  playerId,
  gameState,
  5  // Number of cards to generate
);

// Interpret card effects
const effects = await llmService.interpretCardEffects(
  card,
  playerId,
  gameState,
  targetId  // Optional target player ID
);

// Generate narrative for current game state
const narrative = await llmService.generateNarrative(
  gameState,
  "Player 1 played Fireball dealing 8 damage"  // Optional previous action
);
```

## Architecture

1. **LLM Client Layer**: Handles API calls, retry logic, and error handling
2. **Card Generation Layer**: Creates contextual cards based on game state
3. **Effect Interpretation Layer**: Translates card effects into concrete game actions
4. **Game Engine Integration**: Connects LLM functionality to the game engine

## Error Handling

The LLM client includes robust error handling:
- Rate limit detection
- Retry logic for transient failures
- Error normalization
- Detailed error reporting