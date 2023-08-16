import { ChatCompletionFunctions } from "openai";
import functionSchemas from "../prompts/functionSchemas";
import { handGenerationPrompt } from "../prompts/prompts";
import { callChatCompletion } from "../services/openAIService";
import { Card } from "../models";

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