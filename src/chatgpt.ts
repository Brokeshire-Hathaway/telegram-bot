import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export default async function routes(server: FastifyInstance, _options: Object) {
  server.get("/", async (request, reply) => {
      chatgptHandler(request, reply);
  });
}

async function chatgptHandler(request: FastifyRequest, response: FastifyReply) {
    response.send({ Hello: "world!" });
}

import fs from "fs";
function loadEnv() {
  const dotenv = fs.readFileSync(".env").toString();
  for (const line of dotenv.split("\n")) {
    try {
      let [p1, p2] = line.split("=");
      process.env[p1] = p2;
    } catch (e) {
      console.error(e);
      process.exit(2);
    }
  }
}
loadEnv();

////const llm = new OpenAI({
////  openAIApiKey: process.env.OPENAI_API_KEY,
////  temperature: 0.7,
////});
////const result = await llm.predict(
////  "What would be a good company name for an AI powered cryptocurrency decentralized finance platform?",
////);
////console.log(result);
//
//const chat = new ChatOpenAI({
//  //openAIApiKey: process.env.OPENAI_API_KEY,
//  temperature: 0,
//});
//const result = await chat.predict(
//  "What would be a good company name for an AI powered cryptocurrency decentralized finance platform?",
//);
//console.log(result);
//
//import { ConversationChain } from "langchain/chains";
//import { ChatOpenAI } from "langchain/chat_models/openai";
//import {
//  ChatPromptTemplate,
//  HumanMessagePromptTemplate,
//  SystemMessagePromptTemplate,
//  MessagesPlaceholder,
//} from "langchain/prompts";
//import { BufferMemory } from "langchain/memory";
//
//const chat = new ChatOpenAI({ temperature: 0 });
//
//const chatPrompt = ChatPromptTemplate.fromPromptMessages([
//  SystemMessagePromptTemplate.fromTemplate(
//    "The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.",
//  ),
//  new MessagesPlaceholder("history"),
//  HumanMessagePromptTemplate.fromTemplate("{input}"),
//]);
//
//// Return the current conversation directly as messages and insert them into the MessagesPlaceholder in the above prompt.
//const memory = new BufferMemory({
//  returnMessages: true,
//  memoryKey: "history",
//});
//
//const chain = new ConversationChain({
//  memory,
//  prompt: chatPrompt,
//  llm: chat,
//  verbose: true,
//});
//
//const res = await chain.call({
//  input: "My name is Jim.",
//});
//console.log(res);
import { Configuration, OpenAIApi } from "openai";

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

async function chatGippity(prompt: string) {
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

chatGippity("How can I open a new crypto wallet?");
