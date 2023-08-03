import { insertEmbeddings } from "./database";

class Document {
  text: string;
  embeddings: number[];
  isInDb: boolean;

  constructor(text: string) {
    this.text = text;
    this.embeddings = [];
    this.isInDb = false;
  }

  isInVectorDb() {
    // TODO: Check if text is currently in vector db
    let isInDb = true;
    this.isInDb = isInDb;
    return this.isInDb;
  }

  generateEmbedding(): number[] {
    // TODO
    // call openai embedding API and get embeddings
    let results = [0];
    return results;
  }
}

export function createEmbeddings(documents: string[]) {
  const textToAdd: string[] = [];
  const embeddingsToAdd: number[][] = [];
  for (const text of documents) {
    const doc = new Document(text);
    if (!doc.isInVectorDb()) {
        textToAdd.push(doc.text);
        embeddingsToAdd.push(doc.generateEmbedding());
    }
  }
  insertEmbeddings(textToAdd, embeddingsToAdd);
}
