import { insertEmbeddings } from "./database.js";
import { embeddingsModel } from "./config.js";
import { openai } from "./chatgpt.js";

async function generateEmbeddings(documents: string[]): Promise<number[][]> {
    // send request to generate embeddings
    const res = await openai.embeddings.create({
        input: documents,
        model: embeddingsModel,
    });
    // Flatten embeddings, then return. Not error handling because if this fails 
    // our whole application should fail.
    return res.data.map((data) => data.embedding);
}

export async function createEmbeddings(documents: string[]) {
    const embeddings = await generateEmbeddings(documents);
    await insertEmbeddings(documents, embeddings);
}
