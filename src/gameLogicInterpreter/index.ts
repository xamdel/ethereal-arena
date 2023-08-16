// Interpret nonstandard and novel card effects into specific changes to game state

import { GameState } from "../context";
import { Card } from "../models";
import functionSchemas from "../prompts/functionSchemas";
import { cardInterpretationPrompt } from "../prompts/prompts";
import { callChatCompletion } from "../services/openAIService";
import { constructGameStateJSON } from "./helpers";

// Use GLI to select appropriate state update functions for card effects
export const selectStateUpdateFunctions = async (card: Card, gameState: GameState) => {
    const gameStateJSONString = JSON.stringify(constructGameStateJSON(gameState));
    const prompt = cardInterpretationPrompt(card.effect, gameStateJSONString);

    const response = await callChatCompletion(prompt, [functionSchemas.select_functions], {name: "select_functions"});

    return response.message?.function_call?.arguments;
}

// Use GLI to provide arguments for each update function chosen