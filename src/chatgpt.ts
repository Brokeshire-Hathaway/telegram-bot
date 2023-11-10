import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ChatCompletionFunctions,
  ChatCompletionResponseMessage,
  Configuration,
  CreateChatCompletionRequest,
  OpenAIApi,
} from "openai";
import {
  chatgptModel,
  chatgptTemperature,
  systemMessage,
  nDocumentsToInclude,
} from "./config";
import { queryVectorDatabase } from "./database";

export type ChatbotBody = {
  prompt: string;
  functions?: ChatCompletionFunctions[];
};

export default function routes(
  server: FastifyInstance,
  _options: Object,
  done: any
) {
  server.post("/query", chatgptHandler);
  done();
}

export async function chatgptHandler(
  request: FastifyRequest,
  response: FastifyReply
) {
  try {
    if (!(request.body as ChatbotBody).prompt) {
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
    nDocumentsToInclude
  );
  const relevantDocsFormatted = relevantDocuments[0].reduce((acc, doc, index) => {
    return `
${acc}
## Search Result ${index + 1}
\`\`\`
${doc}
\`\`\`
`
  }, "");
  const systemMessageWithContext =
`
${systemMessage}

# Context
${relevantDocsFormatted}
`;
  console.log(`================ systemMessageWithContext:
  ${systemMessageWithContext}`);

  const userMessage = query.prompt;
  const openai = getOpenAiInstance();
  const chat_object: CreateChatCompletionRequest = {
    messages: [
      { role: "system", content: systemMessageWithContext },
      { role: "user", content: userMessage },
    ],
    model: chatgptModel,
    temperature: chatgptTemperature,
  };
  if (query.functions) {
    chat_object.functions = query.functions;
    chat_object.function_call = "auto";
  }
  const chat_completion = await openai.createChatCompletion(chat_object);
  const message = chat_completion.data.choices[0].message;

  if (!message) throw new Error("Message not available");

  return message;
}
