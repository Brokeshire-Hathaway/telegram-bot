export const START_MESSAGE = `Hey there, crypto enthusiast! 🔥 I'm Brokeshire, your personal crypto companion. 😎🚀 Whether you're a seasoned trader or just starting out, I'm here to light up your journey through the DeFi universe. 🌌

Curious about what I can do for you? Try the following messages:

1️⃣ \`Swap arb for op\`

2️⃣ \`Send 0.01 eth to Jack\`

3️⃣ \`Price of Arweave\`

Use \`/help\` to discover even more things that I can do. 💁‍♂️`;

export const SUCCESS_FUND_MESSAGE = (
  url: string,
) => `Code redeemed successfully!

[View airdrop on blockchain](${url}) or use /balance to see it here.`;

export const DEFAULT_BROKESHIRE_MESSAGE = `Hello there! 🌟

Got an invite code? 🎉 Simply send */join &lt;your invite code&gt;* to unlock the full Brokeshire experience.

Example: \`/join 12345abcd\`

If you're not yet part of the Brokeshire crew, don't worry, you've been added to our waitlist. 📝 We'll reach out as soon as a spot opens up!`;

export const CODE_REDEEMED_SUCCESS = (codes: readonly { code: string }[]) => {
  const codesMessage = codes.map((v) => ` • ${v.code}`).join("\n");
  return `Congratulations! 🎉 Your exclusive invite code has been successfully redeemed. Welcome to the Brokeshire family.

**Level 1:** You now have 5 shiny new invite codes to share with your friends and fellow crypto enthusiasts. 💌

${codesMessage}

Rewards await, but be sure to only invite people who will actively engage with Brokeshire to increase your points and unlock more invite codes. 🌟

Together, let's fuel the flames of DeFi innovation! 🔐🔗💰`;
};

export const HELP_MESSAGE = `Hi, I'm Brokeshire, your personal crypto companion. Ask me to do anything for you in the entire crypto cosmos. I'm here to take action and guide you along your journey. 🧞‍♂️ 

Here's a list of things I can do for you:

1️⃣ Swap Tokens Across Chains: Ready to swap tokens between chains? I'm your go-to AI for seamless, cross-chain transactions. 🔄

2️⃣ Send Tokens with Ease: Need to transfer tokens to another wallet? Chat with me, and I'll handle the transaction securely and swiftly. 💸

4️⃣ Deep Dive into Projects/Tokens: Want to know more about a particular project or token? I'll provide you with a comprehensive overview and up-to-the-minute market data. 📊

3️⃣ New Token Support: Got a fresh token that's not in my virtual brain yet? No worries! Share the contract address, and I'll take care of the rest. 🕵️‍♂️

So, whether you're here to trade, learn, or just have some fun, I'm all fired up to assist you! Let's get this crypto party started! 🎉`;
