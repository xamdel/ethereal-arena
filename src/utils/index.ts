import { ChatCompletionFunctions } from "openai";
import functionSchemas from "../prompts/functionSchemas";
import { handGenerationPrompt } from "../prompts/prompts";
import { callChatCompletion } from "../services/openAIService";
import { Card } from "../models";
import { GameState } from "../context";

// Utility function to combine specified function schemas into an array
const getFunctionsArray = (names: string[]): ChatCompletionFunctions[] => {
    return names.map(name => (functionSchemas as any)[name]);
  };

export async function generateHand(): Promise<Card[]> {
  const requiredFunctions = ["generate_hand"];
  const functionsArray = getFunctionsArray(requiredFunctions);

  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    const response = await callChatCompletion(handGenerationPrompt, functionsArray, { "name": "generate_hand" });
    const cardsJSON = response.message?.function_call?.arguments;

    if (!cardsJSON) {
      throw new Error("Failed to generate cards");
    }

    const cardsObject = JSON.parse(cardsJSON);

    if (cardsObject.cards.length >= 5) {
      return cardsObject.cards.slice(0, 5);
    }

    retries++;
  }

  throw new Error("Failed to generate a valid hand after multiple attempts");
}

// Construct reader-friendly JSON of current select game state properties to be added to Game Logic Interpreter prompt
const constructGameStateJSON = (gameState: GameState): object => {
  const player1Status = {
    currentHealth: gameState.player1.health.current,
    maxHealth: gameState.player1.health.max,
    buffs: gameState.player1.buffs,
    debuffs: gameState.player1.debuffs,
  };

  const player2Status = {
    currentHealth: gameState.player2.health.current,
    maxHealth: gameState.player2.health.max,
    buffs: gameState.player2.buffs,
    debuffs: gameState.player2.debuffs,
  };

  const gameStateJSON = {
    turn: gameState.turn,
    turnNumber: gameState.turnNumber,
    player1: player1Status,
    player2: player2Status,
  };

  return gameStateJSON;
};