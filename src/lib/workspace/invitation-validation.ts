import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
export const invitationIdSchema = z.uuid();
export const invitationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email();
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export function invitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
}
export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function readPendingInvitation(value: string | undefined, id: string) {
  if (!value || value.length > 200) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed.id === id &&
      invitationIdSchema.safeParse(parsed.id).success &&
      invitationTokenSchema.safeParse(parsed.token).success
      ? { id: parsed.id as string, token: parsed.token as string }
      : null;
  } catch {
    return null;
  }
}
