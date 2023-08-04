import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ChatCompletionResponseMessage,
  Configuration,
  OpenAIApi,
} from "openai";
import {
  availableFunctions,
  chatgptModel,
  chatgptTemperature,
  nDocumentsToInclude,
  role,
} from "./config";
import { queryVectorDatabase } from "./database";

export type ChatbotBody = {
  prompt: string;
};

export default function routes(
  server: FastifyInstance,
  _options: Object,
  done: any,
) {
  server.post("/query", chatgptHandler);
  done();
}

export async function chatgptHandler(
  request: FastifyRequest,
  response: FastifyReply,
) {
  try {
    if (!(request.body as ChatbotBody).prompt) {
      throw new Error("Malformed request");
    }
    const chatResult = await chatGippity((request.body as ChatbotBody).prompt);
    response.send(chatResult);
  } catch (e) {
    console.error(e);
    response.status(400).send({ msg: e });
    return;
  }
}

let openai: OpenAIApi;
function getOpenAiInstance() {
  if (!openai) {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    openai = new OpenAIApi(configuration);
  }
  return openai;
}

export async function chatGippity(
  query: string,
): Promise<ChatCompletionResponseMessage> {
  const relevantDocuments = await queryVectorDatabase(
    query,
    nDocumentsToInclude,
  );
  const openai = getOpenAiInstance();
  const prompt = `
    You are a representative that is very helpful when it comes to talking about Firepot Finance! 
    Only ever answer truthfully and be as helpful as you can!
    You can also respond with a function action to take if appropriate.
    Context sections:
    ${relevantDocuments}
    Question: """
    ${query}
    """
    Answer as simple text:
  `.replace(/[\n\t]/g, "");
  const chat_completion = await openai.createChatCompletion({
    messages: [{ role: role, content: prompt }],
    model: chatgptModel,
    temperature: chatgptTemperature,
    functions: availableFunctions,
    function_call: "auto",
  });
  const message = chat_completion.data.choices[0].message;
  if (!message) throw new Error("Message not available");
  return message;
}
