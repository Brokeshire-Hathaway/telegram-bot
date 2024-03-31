import chai from "chai";
import { runTools } from "../src/chatgpt.js";
import { ChatCompletionMessageToolCall } from "openai/resources/index.mjs";

chai.should();

describe("Tools", function () {
  it("should wait until tools have completed before returning", async function () {
    this.timeout(5000);

    const toolOne = async () => {
      return new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve("toolOne");
        }, 2000);
      });
    };

    const toolTwo = async () => {
      return new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject("toolTwo");
        }, 500);
      });
    };

    const availableFunctions = {
      toolOne,
      toolTwo,
    };
    const toolCalls: ChatCompletionMessageToolCall[] = [
      {
        id: "call_8PhIViWTepZWeSnNe0XEaYKQ",
        function: {
          arguments: "{}",
          name: "toolOne",
        },
        type: "function",
      },
      {
        id: "call_DOYmuhmxu87ApjyDo05WsQoO",
        function: {
          arguments: "{}",
          name: "toolTwo",
        },
        type: "function",
      },
    ];
    const toolResults = await runTools(toolCalls, availableFunctions);

    console.log("Tool Results:");
    console.log(toolResults);

    toolResults.length.should.equal(2);
  });
});
