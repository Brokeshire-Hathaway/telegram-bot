import { setOpenAiInstance } from "./chatgpt.js";
import { createEmbeddings } from "./embeddings.js";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { TokenTextSplitter } from "langchain/text_splitter";
import { chunkSize, chunkOverlap } from "./config.js";
import { startTelegramBot } from "./telegramBot.js";
import { startTransactionService } from "./service.js";

async function main() {
  setOpenAiInstance();
  startTelegramBot();
  const loader = new DirectoryLoader("documents", {
    ".md": (path) => new TextLoader(path),
  });
  const documents = await loader.load();
  const splitter = new TokenTextSplitter({
    chunkSize,
    chunkOverlap,
  });
  const splitDocs = await splitter.splitDocuments(documents);
  const chunks = splitDocs.map((doc) => doc.pageContent);
  await createEmbeddings(chunks);
  startTransactionService();
  console.log("\n...ready");
}

main();
