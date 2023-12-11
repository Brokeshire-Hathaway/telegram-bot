import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import OpenAI from 'openai';
import {
  chatgptTemperature,
  systemMessageContent as systemMessageMain,
  nDocumentsToInclude,
} from "./config.js";
import { queryVectorDatabase } from "./database.js";
import { getMarket, executeTransaction, sendTokenPreview, tools } from "./gpttools.js";
import { ChatCompletionAssistantMessageParam, ChatCompletionCreateParams, ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionSystemMessageParam, ChatCompletionToolMessageParam, ChatCompletionUserMessageParam } from "openai/resources/index";

//export type Role = "system" | "user" | "assistant";
//export type Content = string;
/*export interface Message {
  role: Role;
  content: Content;
}*/

export type ChatGptModel = "gpt-3.5-turbo-1106" | "gpt-4-1106-preview";

/*export type ChatbotBody = {
  messages: ChatCompletionMessageParam[];
};*/

export type Conversation = ChatCompletionMessageParam[];

/*export default function routes(
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
}*/

export let openai: OpenAI;
export function setOpenAiInstance() {
  if (!openai) {
    openai = new OpenAI();
  }
}
export async function chatGippity(
  userMessage: ChatCompletionUserMessageParam,
  conversationHistory: Conversation = [],
  vectorSearch = true,
  chatGptModel: ChatGptModel = "gpt-4-1106-preview"
): Promise<Conversation> {
  let systemMessageContent: string;
  let context =
`# Context
## Current Date & Time
${new Date().toISOString()}`
  const previousMessage = conversationHistory.length > 0 ? `${getLatestMessageText(conversationHistory)}\n\n` : "";
  if (vectorSearch) {
    const relevantDocuments = await queryVectorDatabase(
      `${previousMessage}${userMessage}`,
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
    context = `${context}${relevantDocsFormatted}`;
  }

  systemMessageContent =
`${systemMessageMain}
${context}`;
  const systemMessage: ChatCompletionSystemMessageParam = { role: "system", content: systemMessageContent };
  const conversation: Conversation = [systemMessage, ...conversationHistory, userMessage];
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    messages: conversation,
    model: chatGptModel,
    temperature: chatgptTemperature,
    tools
  };

  const response = await openai.chat.completions.create(params);
  const responseMessage = response.choices[0].message;
  const newResponses: ChatCompletionMessageParam[] = [];
  newResponses.push(responseMessage);
  conversation.push(responseMessage);

  const toolCalls = responseMessage.tool_calls;
  if (toolCalls) {
    // Keep for server logs
    console.log("==================== Tool Call:");
    console.log(toolCalls);

    const availableFunctions: { [key: string]: (...args: any) => any } = {
      getMarket,
      sendTokenPreview,
      executeTransaction,
    };
    const functionResPromises: ChatCompletionToolMessageParam[] = [];
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const functionToCall = availableFunctions[functionName];
      const functionArgs = JSON.parse(toolCall.function.arguments);
      functionResPromises.push(functionToCall(
        functionArgs
      ));
    }
    const functionResponses = await Promise.allSettled(functionResPromises);
    functionResponses.forEach((functionResponse, index) => {
      const message: ChatCompletionToolMessageParam = {
        tool_call_id: toolCalls[index].id,
        role: "tool",
        content: JSON.stringify(functionResponse),
      };
      newResponses.push(message);
      conversation.push(message);
    });
  }

  const secondResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    messages: conversation,
  });
  const secondResponseMessage = secondResponse.choices[0].message;
  newResponses.push(secondResponseMessage);
  conversation.push(secondResponseMessage);

  // Keep for server logs
  console.log("==================== Messages:");
  console.log("Previous Message:");
  console.log(previousMessage);
  console.log("\nUser Message:");
  console.log(userMessage);
  console.log("\nSystem Message Context:");
  console.log(context);
  console.log("\nAgent Response:");
  console.log(newResponses);

  conversation.shift(); // Remove system message

  return conversation;
}

export function getLatestMessageText(conversation: Conversation): string {
  const assistantContent = conversation.slice(-1)[0].content;

  if (typeof assistantContent !== "string") {
    throw new Error("Chat result content is not string");
  }

  return assistantContent;
}
