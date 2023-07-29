import Fastify from "fastify";
import chatgptRoutes from "./chatgpt";

const server = Fastify({ logger: true });

server.register(chatgptRoutes);

server.listen({ port: 3000 }, function (err, address) {
    server.log.info(address);
    if (err) {
        server.log.error(err);
        process.exit(1);
    }
});
