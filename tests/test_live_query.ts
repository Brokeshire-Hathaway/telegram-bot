import { ChatbotBody } from "../src/chatgpt";

async function queryFirepotChatbot(prompt: string) {
  const body: ChatbotBody = {
    prompt: prompt,
  };
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
    console.log("Prompt: ", prompt);
    res = await queryFirepotChatbot(prompt);
    console.log(res);
}

test_live_query();
