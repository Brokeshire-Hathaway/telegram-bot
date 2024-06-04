# ember-engine

## Setup

To run the project, you need to have the package manager:

- [pnpm](https://pnpm.io/)
- [docker](https://www.docker.com/)
- [docker-compose](https://docs.docker.com/compose/)

After installing `pnpm`, you need to run the databases locally. The database used for
this service is `postgres`. Run the following command in the root of the
repository:

```bash
docker compose -f compose.local.yaml up -d
```

Then, create a test bot by writing to [BotFather](https://t.me/BotFather) and
get a token with the username you choose for the test bot. When creating the bot, make
sure to disable privacy mode to have seemless experience with group chats.

After that, create the `.env` file in the root of the directory as such:

```sh
TELEGRAM_BOT_USERNAME="THE_USERNAME_YOU_SELECTED"
TELEGRAM_BOT_TOKEN="THE_TOKEN_BOT_FATHER_GAVE_YOU"
SECRET_SALT="my_secret_salt"
EMBER_CORE_URL="http://localhost:8000"
IS_TESTNET="true"
DB_USER="user"
DB_PASSWORD="password"
DB_NAME="db"
DB_HOST="localhost"
DB_PORT=5432
FUNDING_WALLET_ID="random_id_for_ember_wallet"
FRONTEND_URL="http://127.0.0.1:3001"
SQUID_INTEGRATOR_ID="ASK_FOR_SQUID_V2_INTEGRATOR_ID"
SQUID_DEFAULT_VERSION=1
```

_Warning: Defining `localhost` for the `FRONTEND_URL` environment variable
(like so `FRONTEND_URL="http://localhost:5173"`) will break Telegram's ability
to render a hyperlink to the transaction. Therefore, `127.0.0.1` must be used._

Lastly, run:

```sh
pnpm i
pnpm dev
```

If it was successfull, you should see in your console something like:

```bash
(node:12714) ExperimentalWarning: `--experimental-loader` may be removed in the future; instead use `register()`:
--import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));'
(Use `node --trace-warnings ...` to show where the warning was created)
chunk count: 21

...ready
Transaction service running at http://0.0.0.0:3000
```

## Linting

The codebase should be formatted using `prettier` and should follow the recommendations
that `eslint` gives with the according configuration setup in the repository. To fix
all the code style errors and get some corrections from eslint do:

```bash
pnpm lint:fix
```

Additionally, the `.vscode` folder has been setup so the formatter is run on each file
save. Please install the recommended extensions for it to work, that is install
`esbenp.prettier-vscode`.

## Feature flags

For now, feature flags in the codebase are set using the environment variables
of the code and are activate by setting them to the string value "true".
Additionally, all of them have a default value so they can be unset in the
`.env` file and use the prefix `FF_` to denote feature flag.

The current feature flags of the project are:

- `FF_EMBER_WALLET`: Feature flag for using the custom made wallet using
  Biconomy SDK, if activated the `/balance` and `/address` command are enabled.
