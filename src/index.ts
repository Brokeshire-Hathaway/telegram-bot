import Fastify from "fastify";
import chatgptRoutes from "./chatgpt";
import { createEmbeddings } from "./embeddings";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

async function main() {
  dotenv.config();
  const documents = fs
    .readFileSync(path.join(__dirname, "documents.txt"))
    .toString()
    .split("\n")
    .filter((val) => !!val);

  await createEmbeddings(documents);

  const server = Fastify({ logger: true });

  server.register(chatgptRoutes);

  server.listen({ port: 3000 }, function (err, address) {
    server.log.info(address);
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
  });
}

main();
