// Interpret nonstandard and novel card effects into specific changes to game state

import { GameState } from "../context";
import { Card } from "../models";
import functionSchemas from "../prompts/functionSchemas";
import { argGenerationPrompt, cardInterpretationPrompt } from "../prompts/prompts";
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
export const provideArguments = async (functionName: string, cardEffect: string) => {
    const prompt = argGenerationPrompt(functionName, cardEffect);

    switch (functionName) {
      case 'negateEffects': {
        const response = await callChatCompletion(prompt, [functionSchemas.negate_effects], { name: 'negate_effects' });
        console.log('logged from switch[negateEffects]: ', response.message?.function_call?.arguments);
        break;
        // return { description: response.message?.function_call?.arguments };
      }
      case 'removeHealth':
      case 'addHealth':
      case 'addEnergy':
      case 'removeEnergy': {
        const response = await callChatCompletion(prompt, [functionSchemas.add_remove_health_energy], { name: 'add_remove_health_energy' });
        console.log('logged from switch[removeHealth/addHealth/addEnergy/removeEnergy]: ',response.message?.function_call?.arguments);
        break;
        // return { target: response.target, value: response.value };
      }
      case 'removeDebuff':
      case 'removeBuff': {
        const response = await callChatCompletion(prompt, [functionSchemas.remove_buff_debuff], { name: 'remove_buff_debuff' });
        console.log('logged from switch[removeDebuff/removeBuff]: ',response.message?.function_call?.arguments);
        break;
        // return { target: response.target, names: response.names };
      }
      case 'addDebuff':
      case 'addBuff': {
        const response = await callChatCompletion(prompt, [functionSchemas.add_buff_debuff], { name: 'add_buff_debuff' });
        console.log('logged from switch[addDebuff/addBuff]: ',response.message?.function_call?.arguments);
        break;
        // return { target: response.target, name: response.name, description: response.description, duration: response.duration };
      }
      default:
        throw new Error(`Unknown function name: ${functionName}`);
    }
  };
  