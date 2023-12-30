import { ChromaClient, Collection, OpenAIEmbeddingFunction } from "chromadb";
import { collectionName } from "./config.js";

/*
 * Singleton client
 */
let client: ChromaClient;
let collection: Collection;

/*
 * Gets/gives singleton chroma client
 * Future devs: Do we want to create a connection pool if req/s gets too high?
 */
async function getDbClient(): Promise<ChromaClient> {
  if (!client) {
    client = new ChromaClient({
      // Thanks to docker compose putting this app and the chroma_server on
      // the same network, chroma_server resolves to the chroma_server IP
      path: `http://chroma_server:${process.env.CHROMA_PORT!}`,
    });
    while (true) {
      try {
        await client.heartbeat();
        break;
      } catch (e) {
        console.log("sleeping to wait for db connection...");
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  return client;
}

export async function getDbCollection(): Promise<Collection> {
  if (!collection) {
    const client = await getDbClient();
    collection = await client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: new OpenAIEmbeddingFunction({
        openai_api_key: process.env.OPENAI_API_KEY!,
      }),
    });
  }
  return collection;
}

/*
 * Executes query on Chroma vector database
 */
export async function queryVectorDatabase(
  queryString: string,
  nResults: number,
): Promise<(string | null)[][]> {
  const collection = await getDbCollection();
 // TODO: is queryVectorDatabase failing?
  const results = await collection.query({
    nResults,
    queryTexts: queryString,
  });
  return results.documents;
}

export async function insertEmbeddings(
  documents: string[],
  embeddings: number[][],
) {
  const collection = await getDbCollection();
  let ids: string[] = new Array(documents.length).fill("");
  for (let i = 0; i < documents.length; ++i) {
    ids[i] = i.toString();
  }
  await collection.add({
    ids: ids,
    documents,
    embeddings,
  });
}
