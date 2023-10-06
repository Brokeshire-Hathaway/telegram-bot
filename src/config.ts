import { ChatCompletionFunctions } from "openai";

export const embeddingsModel = "text-embedding-ada-002";
export const collectionName = "FIREPOT_HELPERS";
export const chatgptModel = "gpt-3.5-turbo-0613";
// localhost doesn't work because docker
export const HOST = "0.0.0.0";
export const PORT = 3000;
export const chatgptTemperature = 0.7;
export const role = "user";
export const availableFunctions: ChatCompletionFunctions[] = [
  /*{
    name: "create_wallet",
    description: "Create a Firepot Finance wallet/account for a new DeFi User",
    parameters: {
      type: "object",
      properties: {},
    },
  },*/
];
export const nDocumentsToInclude = 2;
export const modelPrompt = `
Your name is Ember and you are an AI copilot for Firepot Finance that is charismatic, fun and very helpful! 
You provide answers about Firepot, crypto and DeFi. 
You are also curious about people and like asking them questions.
Only ever answer truthfully and be as helpful as you can! 
You can also respond with a function action to take if appropriate.`;
