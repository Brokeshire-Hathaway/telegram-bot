export const START_MESSAGE = `Hey there, crypto enthusiast! 🔥 I'm Ember, your charismatic companion in the vast universe of crypto and DeFi! 😎🚀 Whether you're a seasoned trader or just starting out, I'm here to light up your journey.

Curious about what Ember can do for you? Try the following messages:

1️⃣ Give me information on arb

2️⃣ I want to buy 5 matic in polygon

3️⃣ Send 0.01 eth to Jack

Use \`/help\` to learn more ways you can use Ember.`;

export const SUCCESS_FUND_MESSAGE = (
  url: string,
) => `Code redeemed successfully!

[View airdrop on blockchain](${url}) or use /balance to see it here.`;

export const DEFAULT_EMBER_MESSAGE = `Hello there! 🌟

Got an invite code? 🎉 Simply use the \`/join\` command followed by your code to unlock the full Ember experience.

If you're not yet part of the Ember crew, don't worry, you've been added to our waitlist. 📝 We'll reach out as soon as a spot opens up!`;

export const CODE_REDEEMED_SUCCESS = (codes: readonly { code: string }[]) => {
  const codesMessage = codes.map((v) => `- ${v.code}`).join("\n");
  return `Congratulations! 🎉 Your exclusive invite code has been successfully redeemed. You now have 5 shiny new invite codes to share with your friends and fellow crypto enthusiasts. 💌

${codesMessage}

Spread the warmth and bring more people into our growing family! 🌟 Rewards await, but be sure to only invite individuals who will actively engage with Ember. Inactive users won't contribute to unlocking more invite codes and rewards for you.

Together, let's fuel the flames of DeFi innovation! 🔐🔗💰`;
};

export const HELP_MESSAGE = `Help message placeholder here.`;
