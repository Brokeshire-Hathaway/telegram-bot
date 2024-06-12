export const START_MESSAGE = `Hey there, crypto enthusiast! 🔥 I'm Ember, your charismatic companion in the vast universe of crypto and DeFi! 😎🚀 Whether you're a seasoned trader or just starting out, I'm here to light up your journey.

Curious about what Ember can do for you? Here's the lowdown:

1️⃣ Ask Ember Anything: From the latest DeFi trends to sharing my knowledge about the entire crypto cosmos, I'm here to answer your crypto queries. Just ask!

2️⃣ Deep Dive into Projects/Tokens: Want to know more about a particular project or token? I'll provide you with a comprehensive overview and up-to-the-minute market data. 📊

3️⃣ New Token Support: Got a fresh token that's not in our database yet? No worries! Share the contract address, and I'll dig up all the info you need. 🕵️‍♂️

4️⃣ Send Tokens with Ease: Need to transfer tokens to another wallet? Chat with me, and I'll handle the transaction securely and swiftly. 💸

5️⃣ Swap Tokens Across Chains: Ready to swap tokens between EVM chains? I'm your go-to AI for seamless, cross-chain transactions. 🔄

So, whether you're here to trade, learn, or just have some fun, I'm all fired up to assist you! Let's get this crypto party started! 🎉`;

export const SUCCESS_FUND_MESSAGE = (
  url: string,
) => `Code redeemed successfully!

[View airdrop on blockchain](${url}) or use /balance to see it here.`;

export const DEFAULT_EMBER_MESSAGE = `Hello there! 🌟

It seems like you're eager to dive into the world of crypto with Ember, and I'm just as excited to have you on board! 🚀

If you're not yet part of the Ember crew, don't worry, you've been added to our waitlist. 📝 We'll reach out as soon as a spot opens up!

Got an invite code? Fantastic! 🎉 Simply use the \`/join\` command followed by your code to unlock the full Ember experience.

Can't wait to assist you on your crypto journey! 🔥`;

export const CODE_REDEEMED_SUCCESS = (codes: readonly { code: string }[]) => {
  const codesMessage = codes.map((v) => `- ${v.code}`).join("\n");
  return `Congratulations! 🎉 Your exclusive invite code has been successfully redeemed. You now have 5 shiny new invite codes to share with your friends and fellow crypto enthusiasts. 💌

${codesMessage}

Spread the warmth and bring more people into our growing family! 🌟 Rewards await, but be sure to only invite individuals who will actively engage with Ember. Inactive users won't contribute to unlocking more invite codes and rewards for you.

Together, let's fuel the flames of DeFi innovation! 🔐🔗💰`;
};
