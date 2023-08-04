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
  {
    name: "create_wallet",
    description: "Create a Firepot Finance wallet/account for a new DeFi User",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];
export const nDocumentsToInclude = 2;
export const modelPrompt = `
You are a representative that is very helpful when it comes to talking about Firepot Finance!
Only ever answer truthfully and be as helpful as you can! 
You can also respond with a function action to take if appropriate.`;
