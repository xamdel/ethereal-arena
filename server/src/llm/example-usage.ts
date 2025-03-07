import { generateCards, interpretCardEffects } from './index';
import { v4 as uuidv4 } from 'uuid';

/**
 * Example of how to use the LLM integration layer
 * 
 * This file demonstrates:
 * 1. Generating a batch of cards
 * 2. Interpreting a card's effects in the context of a game state
 */
async function exampleUsage() {
  try {
    console.log('Starting LLM integration example...');

    // Step 1: Generate a batch of cards
    console.log('\n--- Generating Cards ---');
    
    // Example player context for contextual card generation
    const playerContext = {
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
    };

    console.log('Generating cards with player context:', JSON.stringify(playerContext, null, 2));
    const cards = await generateCards(3, playerContext);
    
    console.log(`Generated ${cards.length} cards:`);
    cards.forEach(card => {
      console.log(`\n--- ${card.name} (${card.cost} energy) ---`);
      console.log(`Description: ${card.description}`);
      console.log('Base Effects:', card.base_effects.map(e => `${e.effect_type} ${e.value} to ${e.target}`).join(', '));
      console.log(`Wildcard: ${card.wildcard_effect}`);
      console.log(`Art: ${card.art_prompt}`);
    });

    // Step 2: Interpret a card's effects
    console.log('\n\n--- Interpreting Card Effects ---');

    // Example game state
    const gameState = {
      players: {
        'player1': {
          id: 'player1',
          hp: 45,
          maxHp: 80,
          block: 0,
          energy: 3,
          statusEffects: [
            {
              id: uuidv4(),
              name: 'Vulnerable',
              description: 'Takes 50% more damage from attacks',
              duration: 2
            }
          ]
        },
        'player2': {
          id: 'player2',
          hp: 60,
          maxHp: 80,
          block: 5,
          energy: 5,
          statusEffects: []
        }
      },
      activePlayerId: 'player1',
      turn: 3,
      phase: 'action'
    };

    // Use the first generated card for interpretation
    const cardToInterpret = cards[0];
    console.log(`Interpreting effects for card: ${cardToInterpret.name}`);
    
    const interpretedEffects = await interpretCardEffects(
      cardToInterpret,
      'player1', // Player using the card
      gameState
    );

    console.log('\nInterpretation Results:');
    console.log('\nNarrative:', interpretedEffects.narrative);
    
    console.log('\nState Changes:');
    interpretedEffects.stateChanges.forEach((change) => {
      console.log(`- ${change.action} on ${change.target}, value: ${change.value}`);
      console.log(`  Reasoning: ${change.reasoning}`);
      if (change.action === 'ADD_STATUS_EFFECT') {
        console.log(`  Status: ${change.statusName} - ${change.statusDescription} for ${change.duration} turns`);
      }
    });

    console.log('\nExample completed successfully!');
  } catch (error) {
    console.error('Error in example:', error);
  }
}

// Uncomment to run the example
// exampleUsage();

export default exampleUsage;