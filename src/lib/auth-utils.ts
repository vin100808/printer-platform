import { createHash } from "node:crypto";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now = new Date(), ttlDays = 7) {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}
