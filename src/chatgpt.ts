import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
    ChatCompletionFunctions,
  ChatCompletionResponseMessage,
  Configuration,
  OpenAIApi,
} from "openai";
import {
  chatgptModel,
  chatgptTemperature,
  modelPrompt,
  nDocumentsToInclude,
  role,
} from "./config";
import { queryVectorDatabase } from "./database";

export type ChatbotBody = {
  prompt: string;
  functions: ChatCompletionFunctions[];
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
    if (
      !(request.body as ChatbotBody).prompt ||
      !(request.body as ChatbotBody).functions
    ) {
      throw new Error("Malformed request");
    }
    const chatResult = await chatGippity(request.body as ChatbotBody);
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
    query: ChatbotBody
): Promise<ChatCompletionResponseMessage> {
  const relevantDocuments = await queryVectorDatabase(
    query.prompt,
    nDocumentsToInclude,
  );
  const openai = getOpenAiInstance();
  const prompt = `
    ${modelPrompt}
    Context sections:
    ${relevantDocuments}
    Question: """
    ${query.prompt}
    """
    Answer as simple text:
  `.replace(/[\n\t]/g, "");
  const chat_completion = await openai.createChatCompletion({
    messages: [{ role: role, content: prompt }],
    model: chatgptModel,
    temperature: chatgptTemperature,
    functions: query.functions,
    function_call: "auto",
  });
  const message = chat_completion.data.choices[0].message;
  if (!message) throw new Error("Message not available");
  return message;
}
