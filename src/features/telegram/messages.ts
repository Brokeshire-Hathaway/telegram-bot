export const START_MESSAGE = `Hi! To start using Ember:

- Check your Ember wallet address using \`/address\`.
- Send funds in your preferred EVM chain to that address.
- Check the funds were added to your account correctly using the \`/balance\` command.

What you can do:

- Ask Ember about what he can do for you.
- Ask about a project or token to get an overview and market data.
- Also support contract addresses for new tokens that might not be in our database.
- Send tokens to any wallet by chatting with Ember.
- Swap different tokens between any pair of EVM chains.`;

export const SUCCESS_FUND_MESSAGE = (
  url: string
) => `Code redeemed successfully!

[View airdrop on blockchain](${url}) or use /balance to see it here.`;
