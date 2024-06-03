import { ENVIRONMENT } from "../../common/settings";

const EXPLANATION_EMBER_WALLET = ENVIRONMENT.FF_EMBER_WALLET
  ? `
- Check your Ember wallet address using \`/address\`.
- Send funds in your preferred EVM chain to that address.
- Check the funds were added to your account correctly using the \`/balance\` command.

What you can do:
`
  : "";

export const START_MESSAGE = `Hi! To start using Ember:
  ${EXPLANATION_EMBER_WALLET}

- Ask Ember about what he can do for you.
- Ask about a project or token to get an overview and market data.
- Also support contract addresses for new tokens that might not be in our database.
- Send tokens to any wallet by chatting with Ember.
- Swap different tokens between any pair of EVM chains.`;

export const SUCCESS_FUND_MESSAGE = (
  url: string,
) => `Code redeemed successfully!

[View airdrop on blockchain](${url}) or use /balance to see it here.`;

export const DEFAULT_EMBER_MESSAGE = `Hello there! 🌟

It seems like you're eager to dive into the world of crypto with Ember, and I'm just as excited to have you on board! 🚀

If you're not yet part of the Ember crew, don't worry, you've been added to our waitlist. 📝 We'll reach out as soon as a spot opens up!

Got an invite code? Fantastic! 🎉 Simply use the \`/join\` command followed by your code to unlock the full Ember experience.

Can't wait to assist you on your crypto journey! 🔥`;
