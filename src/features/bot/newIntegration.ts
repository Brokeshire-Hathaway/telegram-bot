import { Conversation } from "@grammyjs/conversations";
import { MyContext } from "./common";
import { InlineKeyboard } from "grammy";
import { ENVIRONMENT } from "../../common/settings";

// String for cancelling conversation
const CANCEL_PIVOT = "CANCEL";

// Type of integrations menu
const TYPE_OF_INTEGRATIONS = ["public", "cllient"];
const INTEGRATIONS_KEYBOARD = new InlineKeyboard()
  .text("Public", TYPE_OF_INTEGRATIONS[0])
  .text("Client", TYPE_OF_INTEGRATIONS[1])
  .text("Cancel", CANCEL_PIVOT);

// Conversation for creating integration
export default async function (
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  await ctx.reply(
    `What is the name of the integration? (Write ${CANCEL_PIVOT} at any time to stop this process)`,
  );

  // Get integration name
  const integrationNameCtx = await conversation.wait();
  if (!integrationNameCtx.message?.text) return;
  const integrationName = integrationNameCtx.message.text;
  if (!integrationName || integrationName === CANCEL_PIVOT) return;

  // Get type of integration
  await ctx.reply("Is the integration a public chat or client integration?!", {
    reply_markup: INTEGRATIONS_KEYBOARD,
  });
  const typeOfIntegration = await conversation.waitForCallbackQuery(
    TYPE_OF_INTEGRATIONS.concat([CANCEL_PIVOT]),
    {
      otherwise: (ctx) =>
        ctx.reply("Is the integration a public chat or client integration?!", {
          reply_markup: INTEGRATIONS_KEYBOARD,
        }),
    },
  );
  if (typeOfIntegration.match === CANCEL_PIVOT) return;
  try {
    const integration = await conversation.external(() =>
      createIntegration(
        integrationName,
        typeOfIntegration.match === TYPE_OF_INTEGRATIONS[0],
      ),
    );
    await ctx.reply(`Integration created sucessfully! Here is the info:
    - Name: ${integration.name}
    - ${integration.entrypoint_type}: ${integration.entrypoint}
    `);
  } catch (error) {
    await ctx.reply(`${error}`);
    return;
  }
}

interface Integration {
  name: string;
  entrypoint_type: string;
  entrypoint: string;
}
async function createIntegration(name: string, isPublic: boolean) {
  const response = await fetch(
    `${ENVIRONMENT.BROKESHIRE_API_URL}/integration`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name,
        is_public: isPublic,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Error creating integration: ${await response.text()}`);
  }
  return (await response.json()) as Integration;
}
