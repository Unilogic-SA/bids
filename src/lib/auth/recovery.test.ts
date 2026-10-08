import assert from "node:assert/strict"
import { test } from "node:test"
import { createRecoveryProof, readRecoveryProof, RECOVERY_TTL } from "./recovery"
const key = "test-only-recovery-signing-key-32-bytes"
const now = 1_800_000_000_000

test("password recovery proof is signed, time limited, and bound to verified user/session", () => {
  const proof = createRecoveryProof("A", "session-A", "/?q=chairs#result-2", now, key)
  assert.equal(readRecoveryProof(proof, "A", "session-A", now, key)?.next, "/?q=chairs#result-2")
  assert.equal(readRecoveryProof(proof, "B", "session-A", now, key), null)
  assert.equal(readRecoveryProof(proof, "A", "session-B", now, key), null)
  assert.equal(readRecoveryProof(proof, "A", "session-A", now + RECOVERY_TTL * 1000, key), null)
  assert.equal(readRecoveryProof(proof, "A", "session-A", now, "other-key-with-at-least-32-characters"), null)
  assert.equal(readRecoveryProof("?recovery=true", "A", "session-A", now, key), null)
  const [payload, signature] = proof.split(".")
  const tampered = Buffer.from(JSON.stringify({ userId: "B", sessionId: "session-A", expiresAt: now + 10000, next: "/" })).toString("base64url")
  assert.equal(readRecoveryProof(`${tampered}.${signature}`, "B", "session-A", now, key), null)
  assert.equal(readRecoveryProof(`${payload}.x`, "A", "session-A", now, key), null)
  assert.throws(() => createRecoveryProof("A", "session-A", "/", now, "short"))
})
test("recovery proof cannot carry external/admin destinations", () => {
  const proof = createRecoveryProof("A", "session-A", "/admin", now, key)
  assert.equal(readRecoveryProof(proof, "A", "session-A", now, key)?.next, "/")
})
