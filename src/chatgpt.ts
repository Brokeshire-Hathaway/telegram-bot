import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import OpenAI from 'openai';
import {
  chatgptModel,
  chatgptTemperature,
  systemMessageContent,
  nDocumentsToInclude,
} from "./config.js";
import { queryVectorDatabase } from "./database.js";
import { getMarket, tools } from "./gpttools.js";
import { ChatCompletionMessage, ChatCompletionMessageParam, ChatCompletionSystemMessageParam, ChatCompletionToolMessageParam } from "openai/resources/index";

//export type Role = "system" | "user" | "assistant";
//export type Content = string;
/*export interface Message {
  role: Role;
  content: Content;
}*/

export type ChatbotBody = {
  messages: ChatCompletionMessageParam[];
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

export let openai: OpenAI;
export function setOpenAiInstance() {
  if (!openai) {
    openai = new OpenAI();
  }
}
export async function chatGippity(
  query: ChatbotBody
): Promise<ChatCompletionMessage> {
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
`${systemMessageContent}

# Context
## Current Date & Time
${new Date().toISOString()}${relevantDocsFormatted}`;

  //console.log(`================ systemMessageWithContext:
  //${systemMessageWithContext}`);

  const systemMessage: ChatCompletionSystemMessageParam = { role: "system", content: systemMessageWithContext };
  const messages: Array<ChatCompletionMessageParam> = [systemMessage, ...query.messages];
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    messages,
    model: chatgptModel,
    temperature: chatgptTemperature,
    tools
  };

  /*console.log(`================ chatObject:`);
  console.log(params);
  console.log(`================ end chatObject`);*/

  /*if (query.functions) {
    params.functions = query.functions;
    params.function_call = "auto";
  }*/


  const response = await openai.chat.completions.create(params);
  const responseMessage = response.choices[0].message;

  // Step 2: check if the model wanted to call a function
  const toolCalls = responseMessage.tool_calls;
  if (toolCalls) {
    // Step 3: call the function
    // Note: the JSON response may not always be valid; be sure to handle errors
    const availableFunctions: { [key: string]: (args: any) => any } = {
      get_market: getMarket,
    }; // only one function in this example, but you can have multiple
    messages.push(responseMessage); // extend conversation with assistant's reply

    const functionResPromises: ChatCompletionToolMessageParam[] = [];
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const functionToCall = availableFunctions[functionName];
      const functionArgs = JSON.parse(toolCall.function.arguments);
      functionResPromises.push(functionToCall(
        functionArgs.token_search
      ));
    }
    const functionResponses = await Promise.allSettled(functionResPromises);
    functionResponses.forEach((functionResponse, index) => {
      messages.push({
        tool_call_id: toolCalls[index].id,
        role: "tool",
        content: JSON.stringify(functionResponse),
      }); // extend conversation with function response
    });

    /*console.log(`================ messages:`);
    console.log(messages);*/

    const secondResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: messages,
    }); // get a new response from the model where it can see the function response
    return secondResponse.choices[0].message;
  }

  //const chatCompletion = await openai.createChatCompletion(params);
  //const message = chatCompletion.data.choices[0].message;

  // Keep for server logs
  console.log("==================== Messages:");
  console.log(messages);

  return responseMessage;
}
