import Fastify from "fastify";
import chatgptRoutes from "./chatgpt";
import { createEmbeddings } from "./embeddings";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { HOST, PORT } from "./config";

async function main() {
  dotenv.config();
  const documents = fs
    .readFileSync(path.join(__dirname, "../documents.txt"))
    .toString()
    .split("\n")
    .filter((val) => !!val);

  await createEmbeddings(documents);

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
