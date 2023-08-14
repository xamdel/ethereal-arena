import { ChatCompletionFunctions } from "openai";
import functionSchemas from "../prompts/functionSchemas";
import { handGenerationPrompt } from "../prompts/prompts";
import { callChatCompletion } from "../services/openAIService";

// Utility function to combine specified function schemas into an array
const getFunctionsArray = (names: string[]): ChatCompletionFunctions[] => {
    return names.map(name => (functionSchemas as any)[name]);
  };

export async function generateHand() {
    const requiredFunctions = ["generate_hand"];
    const functionsArray = getFunctionsArray(requiredFunctions);
    const response = await callChatCompletion(handGenerationPrompt, functionsArray, { name: "generate_hand" });
  
    return response;
  }