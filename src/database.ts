import { ChromaClient } from "chromadb";

const collectionName = "FIREPOT_HELPERS";
let client: ChromaClient;

function getDbClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient();
  }
  return client;
}

export function queryVectorDatabase(
  queryString: string,
  nResults: number,
): string[][] {
  const client = getDbClient();
  client.getOrCreateCollection({ name: collectionName }).then((collection) => {
    collection
      .query({
        nResults,
        queryTexts: queryString,
      })
      .then((results) => {
          // TODO: Return result correctly
        return results.documents;
      });
  });
}

export function insertEmbeddings(documents: string[], embeddings: number[][]) {
  const client = getDbClient();
  client.getOrCreateCollection({ name: collectionName }).then((collection) => {
    collection.add({
      ids: ["TODO: Figure out how to create ids"],
      documents,
      embeddings,
    });
  });
}
