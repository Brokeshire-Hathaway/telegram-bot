import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ChatCompletionFunctions,
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
  Configuration,
  CreateChatCompletionRequest,
  OpenAIApi,
} from "openai";
import {
  chatgptModel,
  chatgptTemperature,
  systemMessageContent,
  nDocumentsToInclude,
} from "./config";
import { queryVectorDatabase } from "./database";

export type Role = "system" | "user" | "assistant";
export type Content = string;
export interface Message {
  role: Role;
  content: Content;
}

export type ChatbotBody = {
  messages: Message[];
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
    if (!(request.body as ChatbotBody).messages) {
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
  /*console.log(`================ query:`);
  console.log(query);
  console.log(`================ end query`);*/


  const userMessage = query.messages.slice(-1)[0]?.content ?? "";
  const assistantMessage = query.messages.slice(-2)[0]?.content ?? "";
  const relevantDocuments = await queryVectorDatabase(
    `${assistantMessage}\n${userMessage}`,
    nDocumentsToInclude
  );
  const relevantDocsFormatted = relevantDocuments[0].reduce((acc, doc, index) => {
    return `${acc}
## Search Result ${index + 1}
\`\`\`
${doc}
\`\`\`
`
  }, "");
  const systemMessageWithContext =
`
${systemMessageContent}

# Context${relevantDocsFormatted}`;

  //console.log(`================ systemMessageWithContext:
  //${systemMessageWithContext}`);

  const openai = getOpenAiInstance();

  const systemMessage: Message = { role: "system", content: systemMessageWithContext };
  const messages = [systemMessage, ...query.messages];
  const chatObject: CreateChatCompletionRequest = {
    messages,
    model: chatgptModel,
    temperature: chatgptTemperature,
  };

  console.log(`================ chatObject:`);
  console.log(chatObject);
  console.log(`================ end chatObject`);

  if (query.functions) {
    chatObject.functions = query.functions;
    chatObject.function_call = "auto";
  }

  const chat_completion = await openai.createChatCompletion(chatObject);
  const message = chat_completion.data.choices[0].message;

  if (!message) throw new Error("Message not available");

  return message;
}
