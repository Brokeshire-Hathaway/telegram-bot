/*import { ChatCompletionFunctions } from "openai";
import { ChatbotBody } from "../chatgpt.js";

async function queryFirepotChatbot(
  prompt: string,
  functions?: [],
) {
  const body: ChatbotBody = {
    prompt: prompt,
  };
  if (functions) {
    body.functions = functions;
  }
  const res = await fetch("http://localhost:3000/query", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }).then((res) => res.json());
  return res;
}

async function test_live_query() {
  let prompt = "what is firepot finance?";
  console.log("Prompt: ", prompt);
  let res = await queryFirepotChatbot(prompt);
  console.log(res);
  prompt = "Let me open a wallet";
  const functions: [] = [
    {
      name: "create_wallet",
      description:
        "Create a Firepot Finance wallet/account for a new DeFi User",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  ];
  console.log("Prompt: ", prompt);
  res = await queryFirepotChatbot(prompt, functions);
  console.log(res);
}

test_live_query();*/
