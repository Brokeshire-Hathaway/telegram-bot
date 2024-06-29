# Telegram BOT

## Setup

To run the project, you need to have the package manager:

- [pnpm](https://pnpm.io/)

Create a test bot by writing to [BotFather](https://t.me/BotFather) and
get a token with the username you choose for the test bot. When creating the bot, make
sure to disable privacy mode to have seemless experience with group chats.

After that, create the `.env` file in the root of the directory as such:

```sh
TELEGRAM_BOT_USERNAME="THE_USERNAME_YOU_SELECTED"
TELEGRAM_BOT_TOKEN="THE_TOKEN_BOT_FATHER_GAVE_YOU"
EMBER_API_URL="http://localhost:3001/v1/public/telegram"
```

Lastly, run:

```sh
pnpm i
pnpm dev
```

If it was successfull, you should see in your console something like:

```bash

> telegram-bot@0.6.0 dev /home/your_user/documents/ember-agi/telegram-bot
> node --import tsx -r dotenv/config src/index.ts

Running telegram bot for user EmberAGITestBot
(node:470331) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
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
