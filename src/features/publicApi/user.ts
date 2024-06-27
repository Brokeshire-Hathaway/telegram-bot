import { ENVIRONMENT } from "../../common/settings";

export async function isUserWhitelisted<T>(id: T) {
  const response = await fetch(
    `${ENVIRONMENT.EMBER_API_URL}/public/telegram/user/${id}/is_whitelisted`,
  );
  return response.ok && ((await response.json()) as boolean);
}

export async function isUserAdmin<T>(id: T) {
  const response = await fetch(
    `${ENVIRONMENT.EMBER_API_URL}/public/telegram/user/${id}/is_admin`,
  );
  return response.ok && ((await response.json()) as boolean);
}

export async function addUser<T>(
  id: T,
  username: string | null | undefined,
  addToWaitList: boolean = true,
) {
  const endpoint = addToWaitList ? "user_waitlist" : "user";
  return await fetch(
    `${ENVIRONMENT.EMBER_API_URL}/public/telegram/${endpoint}/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        username,
      }),
    },
  );
}

interface CodeRedeemResponse {
  user_id: number;
  codes: {
    identifier: string;
    code: string;
  }[];
}
export async function redeemCode<T>(
  id: T,
  username: string | null | undefined,
  code: string,
) {
  const response = await fetch(
    `${ENVIRONMENT.EMBER_API_URL}/public/telegram/user/${id}/join`,
    {
      method: "POST",
      body: JSON.stringify({
        username,
        code,
      }),
    },
  );
  if (!response.ok) throw new Error("Code redemption failed.");

  return (await response.json()) as CodeRedeemResponse;
}
