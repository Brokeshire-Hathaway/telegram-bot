# ember-engine

## Requirements
- [Docker](https://docs.docker.com/engine/install)
- [Node](https://nodejs.org/en/download)
- [yarn](https://classic.yarnpkg.com/lang/en/docs/install)

## Getting Started
```sh
cp .env.template .env
```
Get an [OpenAI key](https://platform.openai.com/account/api-keys).
```sh
echo "OPENAI_API_KEY={{your openai key}}" > .env
./development.bash # starts chroma vector db and fastify server with docker compose
```
