import z from "zod";

export const address = z.custom<`0x${string}`>((val) => {
  return typeof val === "string" ? /^0x[a-fA-F0-9]+$/.test(val) : false;
});
export const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const MULTICALL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const RouteType = z.union([z.literal("buy"), z.literal("swap")]);
export type RouteType = z.infer<typeof RouteType>;
