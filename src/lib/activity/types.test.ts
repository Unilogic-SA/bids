import assert from "node:assert/strict"
import { test } from "node:test"
import { activityMessage, activityBidHref, type ActivityReason } from "./types"
function reason(kind: ActivityReason["kind"], payload: ActivityReason["payload"]): ActivityReason {
  return { key: "test", kind, payload, unread: true, detectedAt: "2026-10-20T10:00:00Z", snoozedUntil: null }
}
test("activity explains the exact change and uses SAST without claiming bid delivery", () => {
  const moved = activityMessage(reason("deadline", { previous: "2026-10-23T09:00:00Z", current: "2026-10-20T09:00:00Z" }))
  assert.match(moved.title, /earlier/)
  assert.match(moved.detail, /11:00 SAST/)
  assert.match(moved.detail, /calendar/)
  assert.match(activityMessage(reason("closing", { closingAt: "2026-10-20T09:00:00Z", passed: true })).detail, /Record submission/)
  assert.match(activityMessage(reason("cancelled", { status: "withdrawn" })).title, /withdrawn/)
  assert.equal(activityBidHref("a/b"), "/workspace?bid=a%2Fb")
})
