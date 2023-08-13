import { Configuration, CreateChatCompletionRequest, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export const callChatCompletion = async (
    messages: CreateChatCompletionRequest["messages"],
    functions?: CreateChatCompletionRequest["functions"],
    function_call?: CreateChatCompletionRequest["function_call"]
) => {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages,
      functions,
      function_call,
    });

    return completion.data.choices[0];
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    throw error;
  }
};