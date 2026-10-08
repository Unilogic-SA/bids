import { createHmac, timingSafeEqual } from "node:crypto"
import { getSafePublicNextPath } from "./redirects"

export const RECOVERY_COOKIE = "openbids-recovery"
export const RECOVERY_TTL = 15 * 60
type RecoveryProof = { userId: string; sessionId: string; expiresAt: number; next: string }

function signingKey(key = process.env.CUSTOMER_AUTH_RECOVERY_SECRET) {
  if (!key || Buffer.byteLength(key) < 32) throw new Error("Password recovery is not configured.")
  return key
}

export function createRecoveryProof(userId: string, sessionId: string, next: string, now = Date.now(), key?: string) {
  if (!userId || !sessionId) throw new Error("Recovery session is missing.")
  const payload = Buffer.from(JSON.stringify({ userId, sessionId, expiresAt: now + RECOVERY_TTL * 1000, next: getSafePublicNextPath(next) })).toString("base64url")
  const signature = createHmac("sha256", signingKey(key)).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function readRecoveryProof(value: string | undefined, userId: string, sessionId: string, now = Date.now(), key?: string): RecoveryProof | null {
  if (!value || value.length > 4096 || !sessionId) return null
  try {
    const [payload, signature, extra] = value.split(".")
    if (!payload || !signature || extra) return null
    const actual = Buffer.from(signature, "base64url")
    const expected = createHmac("sha256", signingKey(key)).update(payload).digest()
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const proof = JSON.parse(Buffer.from(payload, "base64url").toString()) as RecoveryProof
    if (proof.userId !== userId || proof.sessionId !== sessionId || !Number.isFinite(proof.expiresAt) || proof.expiresAt <= now || proof.expiresAt > now + RECOVERY_TTL * 1000) return null
    return { ...proof, next: getSafePublicNextPath(proof.next) }
  } catch { return null }
}
