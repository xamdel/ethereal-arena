import { Configuration, CreateChatCompletionRequest, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export const callChatCompletion = async (
    message: string,
    functions?: CreateChatCompletionRequest["functions"],
    function_call?: CreateChatCompletionRequest["function_call"]
) => {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      messages: [
        {
            role: "system",
            content: message,
        }
      ],
      functions,
      function_call,
    });

    return completion.data.choices[0];
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    throw error;
  }
};