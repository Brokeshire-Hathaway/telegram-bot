export const START_MESSAGE = `Hey there, crypto enthusiast! 🔥 I'm Ember, your personal crypto companion. 😎🚀 Whether you're a seasoned trader or just starting out, I'm here to light up your journey through the DeFi universe. 🌌

Curious about what Ember can do for you? Try the following messages:

1️⃣ \`Swap arb for op\`

2️⃣ \`Send 0.01 eth to Jack\`

3️⃣ \`Price of Arweave\`

Use \`/help\` to discover even more things that Ember can do. 💁‍♂️`;

export const SUCCESS_FUND_MESSAGE = (
  url: string,
) => `Code redeemed successfully!

[View airdrop on blockchain](${url}) or use /balance to see it here.`;

export const DEFAULT_EMBER_MESSAGE = `Hello there! 🌟

Got an invite code? 🎉 Simply send */join &lt;your invite code&gt;* to unlock the full Ember experience.

Example: \`/join 12345abcd\`

If you're not yet part of the Ember crew, don't worry, you've been added to our waitlist. 📝 We'll reach out as soon as a spot opens up!`;

export const CODE_REDEEMED_SUCCESS = (codes: readonly { code: string }[]) => {
  const codesMessage = codes.map((v) => ` • ${v.code}`).join("\n");
  return `Congratulations! 🎉 Your exclusive invite code has been successfully redeemed. Welcome to the Ember family.

**Level 1:** You now have 5 shiny new invite codes to share with your friends and fellow crypto enthusiasts. 💌

${codesMessage}

Rewards await, but be sure to only invite people who will actively engage with Ember to increase your points and unlock more invite codes. 🌟

Together, let's fuel the flames of DeFi innovation! 🔐🔗💰`;
};

export const HELP_MESSAGE = `Help message placeholder here.`;
