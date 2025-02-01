import { getBrokeshireTGUrl } from "../../common/settings";

export async function isUserWhitelisted<T>(id: T) {
  const response = await fetch(
    `${getBrokeshireTGUrl()}/user/${id}/is_whitelisted`,
  );
  return response.ok && ((await response.json()) as boolean);
}

export async function isUserAdmin<T>(id: T) {
  const response = await fetch(`${getBrokeshireTGUrl()}/user/${id}/is_admin`);
  return response.ok && ((await response.json()) as boolean);
}

export async function addUser<T>(
  id: T,
  username: string | null | undefined,
  addToWaitList: boolean = true,
) {
  const endpoint = addToWaitList ? "user_waitlist" : "user";
  return await fetch(`${getBrokeshireTGUrl()}/${endpoint}/${id}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username,
    }),
  });
}

interface CodeCreateResponse {
  url: string;
  code: string;
}
export async function createReferralUrl<T>(id: T, numberOfUses: number) {
  const response = await fetch(`${getBrokeshireTGUrl()}/code`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_chat_id: id,
      remaining_uses: numberOfUses,
    }),
  });
  if (!response.ok) {
    throw new Error(`Referral URL failed: ${await response.text()}`);
  }

  return ((await response.json()) as CodeCreateResponse).url;
}

interface UserJoinResponse {
  user_id: number;
  codes: CodeCreateResponse[];
}
export async function redeemCode<T>(
  id: T,
  username: string | null | undefined,
  code: string,
) {
  console.log(`id: ${id}, username: ${username}, code: ${code}`);
  const response = await fetch(`${getBrokeshireTGUrl()}/user/${id}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      code,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Code redemption failed (${response.status}): ${errorText}`,
    );
  }

  return (await response.json()) as UserJoinResponse;
}
