import { Configuration, OpenAIApi } from "openai";
import { insertEmbeddings } from "./database";
import { embeddingsModel } from "./config";

async function generateEmbeddings(documents: string[]): Promise<number[][]> {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  // send request to generate embeddings
  const res = await openai.createEmbedding({
    input: documents,
    model: embeddingsModel,
  });
  // Flatten embeddings, then retur. Not error handling because if this fails 
  // our whole application should fail.
  return res.data.data.map((data) => data.embedding);
}

export async function createEmbeddings(documents: string[]) {
  const embeddings = await generateEmbeddings(documents);
  await insertEmbeddings(documents, embeddings);
}
