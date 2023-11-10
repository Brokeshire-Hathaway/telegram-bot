import Fastify from "fastify";
import chatgptRoutes from "./chatgpt";
import { createEmbeddings } from "./embeddings";
//import fs from "fs";
//import path from "path";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import {
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
} from "langchain/text_splitter";
import dotenv from "dotenv";
import { HOST, PORT, chunkSize, chunkOverlap } from "./config";
import { startTelegramBot } from "./telegramBot";

async function main() {
  dotenv.config();

  startTelegramBot();

  /*const documents = fs
    .readFileSync(path.join(__dirname, "../documents.txt"))
    .toString()
    .split("\n")
    .filter((val) => !!val);*/

  const loader = new DirectoryLoader("documents", {
    ".md": (path) => new TextLoader(path),
  });
  const documents = await loader.load();

  //console.log({ documents });

  /*const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const splitDocs = await splitter.splitDocuments(documents);*/

  const splitter = new TokenTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const splitDocs = await splitter.splitDocuments(documents);

  const chunks = splitDocs.map((doc) => doc.pageContent);

  console.log(`chunk count: ${chunks.length}`);

  chunks.forEach((chunk, index) => {
    console.log("=====================================");
    console.log(`chunk ${index + 1}: ${chunk}`);
  });

  await createEmbeddings(chunks);

  const server = Fastify({ logger: true });
  server.register(chatgptRoutes);

  // 0.0.0.0 because docker
  server.listen({ host: HOST, port: PORT }, function (err, address) {
    server.log.info(address);
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
  });
}

main();
