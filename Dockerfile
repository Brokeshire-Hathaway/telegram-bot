FROM node:18.8-alpine as build
WORKDIR "/src"
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines
COPY . .
RUN yarn run build

FROM node:18.8-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --ignore-engines
COPY --from=build /src/build/ src
COPY documents documents
COPY .env .env
ENTRYPOINT ["node", "-r", "dotenv/config", "src/index.js"]
