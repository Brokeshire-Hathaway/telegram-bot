import z from "zod";

const ChatEmberRespons = z.object({
  status: z.union([
    z.literal("done"),
    z.literal("processing"),
    z.literal("error"),
  ]),
  message: z.string(),
});

const HOST = process.env.EMBER_CORE_URL || "http://ember-core:8101";
const EMBER_TIMEOUT_MS = 60000;

async function timeoutEmberAction<T>(action: () => Promise<T>): Promise<T> {
  return Promise.race([
    action(),
    new Promise((_, reject) =>
      setTimeout(
        reject,
        EMBER_TIMEOUT_MS,
        new Error("Operation aborted due to tiemout"),
      ),
    ),
  ]) as T;
}

export async function messageEmber(
  senderUid: string,
  threadId: string,
  message: string,
  onActivity: (message: string) => void,
): Promise<string> {
  const PATH = `/v1/threads/${threadId}/messages`;
  const URL = HOST + PATH;
  const messagePayload = { sender_uid: senderUid, message };
  const payload = JSON.stringify(messagePayload);
  const response = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    signal: AbortSignal.timeout(EMBER_TIMEOUT_MS),
  });

  if (!response.ok || response.body == null) {
    throw new Error("Failed to connect to Ember server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const readableStream = await timeoutEmberAction(() => reader.read());
    const { done, value } = readableStream;
    const decodedValue = decoder.decode(value);
    const { event, rawData } = parseSseResponse(decodedValue);
    if (done && event !== "done") {
      throw new Error("Invalid response");
    }

    if (rawData == null) {
      continue;
    }

    const data = await ChatEmberRespons.safeParseAsync(JSON.parse(rawData));
    if (!data.success) {
      throw new Error("Invalid response");
    }
    const response = data.data;

    switch (event) {
      case "done":
        return response.message;
      case "activity":
        onActivity(response.message);
        continue;
      case "error":
        return `Error: ${response.message}`;
      default:
        throw new Error("Invalid response");
    }
  }
}

function parseSseResponse(value: string) {
  const lines = value.split("\n");
  let event = undefined;
  let rawData = undefined;

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.substring("event: ".length).trim();
    } else if (line.startsWith("data: ")) {
      rawData = line.substring("data: ".length);
    }
  }

  return { event, rawData };
}
