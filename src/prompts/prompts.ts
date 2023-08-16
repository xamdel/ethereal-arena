
// TO-DO: 
//  [] create function to insert game state, or string template if at game start
//  [] expand prompt to inject game state; describe basic parameters of cards
// Notes:
// Specify 1v1 - no allies or minions (this is a frequent generation in initial testing)
// Guidance on energy:power ratio required - often the same hand will include dealing 5 damage for 1 energy, or 8 damage for 3 energy
// Energy stealing should be disallowed - too powerful an effect, and a frequent generation
// Will probably need to incorporate some sort of reflexion-type strategies to improve quality of outputs in terms of energy:power ratio. In particular, seeing very strong effects (dispell all buffs from opponent) for 1 energy
// Will need to provide guidance for some level of standardization of language. Example: card "Poison Dagger", effect "Deal 12 damage over 3 turns" - GLI inaccurately selected [removeHealth], which is understandable due to the ambiguous effect description

// Prompt for generating a hand of cards
export const handGenerationPrompt = `Generate a hand of exactly 5 cards that will help your user to win a 1v1 card battle. There are no allies or minions - it is a 1v1 match. Stealing energy from the opponent is disallowed. Cards can deal damage, heal, apply/remove buffs/debuffs from user/target. Pay attention to the ratio of power to energy cost: small amounts of damage/healing, or simple effects should cost 1 energy, up to 4 energy maximum for large damage/healing or complex, powerful effects. The baseline should be approximately 1 energy per 5 damage or healing. Avoid effects that are unfair or unfun for the opponent.`

// Prompt for interpreting a card when played
export const cardInterpretationPrompt = (cardEffect: string, gameState: string) => `Interpret the effects of the card and decide which of the provided functions are required to update the game state. Pay careful attention to buffs and debuffs on both players in making your determination. If there are any buffs or debuffs that would completely negate the effect of the card, choose the 'negateEffects' function.

Card effect: ${cardEffect}
Game state: ${gameState}

Functions: [negateEffects, addHealth, removeHealth, addCardToHand, removeCardFromHand, addBuff, removeBuff, addDebuff, removeDebuff, addEnergy, removeEnergy]
` 