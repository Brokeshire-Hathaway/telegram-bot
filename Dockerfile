FROM node:20.12.2-alpine as build
WORKDIR "/src"
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines
COPY . .
RUN yarn run build

FROM node:20.12.2-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --ignore-engines
COPY --from=build /src/build/ src
COPY documents documents
ENTRYPOINT ["node", "src/index.js"]
