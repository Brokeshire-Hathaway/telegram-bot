interface MessagePayload {
    sender_uid: string;
    message: string;
}

type ResponseStatus = "done" | "processing" | "error";

interface ResponseData {
    status: ResponseStatus;
    message: string;
}

const HOST = 'http://172.17.0.1:8001';

export async function messageEmber(senderUid: string, threadId: string, message: string, onActivity: (message: string) => void): Promise<string> {
    const PATH = `/v1/threads/${threadId}/messages`;
    const URL = HOST + PATH;
    const messagePayload: MessagePayload = { sender_uid: senderUid, message };
    const payload = JSON.stringify(messagePayload);
    // https://github.com/openai/openai-node/blob/c9bb4edaf5bc72ccd81fd7978abd468169255f1c/examples/stream-to-client-raw.ts#L16
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
    const response = await fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: payload,
    });

    if (!response.ok || response.body == null) {
        throw new Error('Failed to connect to Ember server');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        const decodedValue = decoder.decode(value);
        const { event, rawData } = parseSseResponse(decodedValue);
        if (done && event !== "done") {
            throw new Error('Invalid response');
        }

        if (rawData == null) {
            continue;
        }

        const data = JSON.parse(rawData);

        switch (event) {
            case "done":
                if (isValidResponse(data)) {
                    return data.message;
                } else {
                    throw new Error('Invalid response');
                }
            case "activity":
                console.log(`Activity update: ${data}`);
                onActivity(data.message);
                continue;
            case "error":
                return `Error: ${data.message}`
            default:
                throw new Error('Invalid response');
        }
    }
}

function isValidResponse(data: any): data is ResponseData {
    return typeof data === 'object' &&
        'status' in data && 
        (data.status === "done" || data.status === "processing" || data.status === "error") &&
        'message' in data &&
        typeof data.message === 'string';
}

function parseSseResponse(value: string): { event?: string; rawData?: any } {
    const lines = value.split('\n');
    let event = undefined;
    let rawData = undefined;

    for (const line of lines) {
        if (line.startsWith('event: ')) {
            event = line.substring('event: '.length).trim();
        } else if (line.startsWith('data: ')) {
            rawData = line.substring('data: '.length);
        }
    }

    return { event, rawData };
}