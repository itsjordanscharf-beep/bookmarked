import { customAlphabet } from "nanoid";

export const uuid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 21);
export const shareCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
export const viewerToken = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  32
);
