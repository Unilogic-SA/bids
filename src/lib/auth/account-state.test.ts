import assert from "node:assert/strict"
import { test } from "node:test"
import { workspaceLabel, type AccountSnapshot, type AccountState } from "./account-state"
import { createAccountSnapshotReader } from "./snapshot-reader"
const flush = () => new Promise(resolve => setImmediate(resolve))
const A: AccountSnapshot = { status: "signed-in", user: { id: "A", email: "a@example.test" }, profile: { displayName: "Alice" }, workspace: { id: "one", name: null } }

test("workspace has a useful unnamed fallback", () => { assert.equal(workspaceLabel(null), "Your workspace"); assert.equal(workspaceLabel("Named workspace"), "Named workspace") })
test("shared reads coalesce and late previous-user responses cannot resurrect identity", async () => {
  const states: AccountState[] = []
  const pending: Array<(value: AccountSnapshot) => void> = []
  const reader = createAccountSnapshotReader(() => new Promise(resolve => pending.push(resolve)), state => states.push(state))
  reader.refresh(); reader.refresh(); reader.refresh()
  await flush()
  assert.equal(pending.length, 1)
  reader.refresh()
  assert.equal(states.at(-1)?.status, "loading")
  await flush()
  assert.equal(pending.length, 2)
  pending[1]({ status: "signed-out" })
  await flush()
  pending[0](A)
  await flush()
  assert.deepEqual(states.at(-1), { status: "signed-out" })
  assert.ok(!states.some(state => state.status === "signed-in"))
  reader.dispose()
})
test("an account refresh failure and unmount clear/ignore old user state", async () => {
  const states: AccountState[] = []
  let reject = false
  const reader = createAccountSnapshotReader(async () => { if (reject) throw new Error("offline"); return A }, state => states.push(state))
  reader.refresh(); await flush()
  assert.equal(states.at(-1)?.status, "signed-in")
  reject = true
  reader.refresh()
  assert.equal(states.at(-1)?.status, "loading")
  await flush()
  assert.deepEqual(states.at(-1), { status: "unavailable", message: "Your account is temporarily unavailable. Try again." })
  reader.dispose()
  const count = states.length
  reader.refresh(); await flush()
  assert.equal(states.length, count)
})
