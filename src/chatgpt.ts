import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type ChatbotBody = {
    msg: string;
};

export default async function routes(server: FastifyInstance, _options: Object) {
  server.post("/", async (request, reply) => {
      chatgptHandler(request, reply);
  });
}

async function chatgptHandler(request: FastifyRequest, response: FastifyReply) {
    // TODO: Chatgpt request logic
    try {
        throw new 
    } catch (e) {
        response.send(400);
    }
    if ((request.body)
    (request.body as ChatbotBody).msg
    response.send({ Hello: "world!" });
};

//import fs from "fs";
//function loadEnv() {
//  const dotenv = fs.readFileSync(".env").toString();
//  for (const line of dotenv.split("\n")) {
//    try {
//      let [p1, p2] = line.split("=");
//      process.env[p1] = p2;
//    } catch (e) {
//      console.error(e);
//      process.exit(2);
//    }
//  }
//}
//loadEnv();

import { Configuration, OpenAIApi } from "openai";
import { type } from "os";

function create_wallet() {
    console.log("create a wallet for the new user.");
}

const model = "gpt-3.5-turbo-0613";
const role = "user";
const functions = [
  {
    name: "create_wallet",
    description: "Create a Firepot Finance wallet for a new DeFi Wallet",
  },
];

const availableFunctions: { [key: string]: Function } = {
  "create_wallet": create_wallet,
};

export async function chatGippity(prompt: string) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  const chat_completion = await openai.createChatCompletion({
    messages: [{ role, content: prompt }],
    model,
    functions,
    function_call: "auto",
  });
  const message = chat_completion.data.choices[0].message;
  console.log(chat_completion.data.choices[0].message);

  if (message?.function_call) {
      const functionName = message.function_call?.name as string;
      const fnArgs = message.function_call.arguments;
      const functionResponse = availableFunctions[functionName](fnArgs);
  }
}

// Test to include: chatGippity("How can I open a new crypto wallet?");
