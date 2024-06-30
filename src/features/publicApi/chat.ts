import z from "zod";
import { getEmberTGUrl } from "../../common/settings";

const ChatEmberRespons = z.object({
  status: z.union([
    z.literal("done"),
    z.literal("processing"),
    z.literal("error"),
  ]),
  message: z.string(),
});

export default async function (
  senderUid: string,
  message: string,
  isGroup: boolean,
  username: string | undefined,
  onActivity: (message: string) => void,
): Promise<string> {
  const response = await fetch(`${getEmberTGUrl()}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: senderUid,
      message,
      is_group: isGroup,
      username,
    }),
  });

  if (!response.ok || response.body == null) {
    throw new Error("Failed to connect to Ember server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    const { event, rawData } = parseSseResponse(decoder.decode(value));
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
