import { ChromaClient, Collection } from "chromadb";
import { collectionName } from "./config";

/*
 * Singleton client
 */
let client: ChromaClient;

/*
 * Gets/gives singleton chroma client
 * Future devs: Do we want to create a connection pool if req/s gets too high?
 */
async function getDbClient(): Promise<ChromaClient> {
  if (!client) {
    client = new ChromaClient({
      // Thanks to docker compose putting this app and the chroma_server on
      // the same network, chroma_server resolves to the chroma_server IP
      path: "http://chroma_server:8000",
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
  const client = await getDbClient();
  return await client.getOrCreateCollection({ name: collectionName });
}

/*
 * Executes query on Chroma vector database
 */
export async function queryVectorDatabase(
  queryString: string,
  nResults: number,
): Promise<(string | null)[][]> {
  const collection = await getDbCollection();
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
