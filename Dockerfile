FROM node:20-alpine
# get chromadb installed
USER root
WORKDIR /home
RUN apk update
RUN apk add git
COPY --from=library/docker:latest /usr/local/bin/docker /usr/bin/docker
COPY --from=library/docker:latest /usr/local/bin/docker-compose /usr/bin/docker-compose
RUN git clone https://github.com/chroma-core/chroma.git
# get this app installed
WORKDIR /app
COPY . .
RUN yarn install
WORKDIR /home/chroma
# start chromadb, then start node.js fastify server
CMD docker-compose up -d --build; cd /app; npx ts-node src/index.ts
