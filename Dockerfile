ARG NODE_BASE=20.12.2-alpine

FROM node:$NODE_BASE as base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

FROM base AS production-dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm i --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm i --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:$NODE_BASE
WORKDIR /app
COPY --from=production-dependencies /app/node_modules node_modules
COPY --from=build /app/build src
ENTRYPOINT ["node", "src/index.js"]
