import { insertEmbeddings } from "./database";

class Document {
  text: String;
  embeddings: Number[];
  isInDb: boolean;

  constructor(text: String) {
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

  generateEmbedding(): Number[] {
    // TODO
    // call openai embedding API and get embeddings
    let results = [0];
    return results;
  }
}

function loadDocumentForEmbeddings(): String[] {
  return ["TODO"];
}

function addEmbeddingsToDb(lines: String[], embeddings: Number[][]) {
    insertEmbeddings(lines, embeddings);
}

export function createEmbeddings() {
  const documents = loadDocumentForEmbeddings();
  const textToAdd = [];
  const embeddingsToAdd = [];
  for (const text of documents) {
    const doc = new Document(text);
    if (!doc.isInVectorDb()) {
        textToAdd.push(doc.text);
        embeddingsToAdd.push(doc.generateEmbedding());
    }
  }
  addEmbeddingsToDb(textToAdd, embeddingsToAdd);
}
