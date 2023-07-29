import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export default async function routes(server: FastifyInstance, _options: Object) {
  server.get("/", async (request, reply) => {
      chatgptHandler(request, reply);
  });
}

async function chatgptHandler(request: FastifyRequest, response: FastifyReply) {
    response.send({ Hello: "world!" });
}
