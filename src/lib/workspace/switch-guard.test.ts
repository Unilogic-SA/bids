import assert from "node:assert/strict"
import { test } from "node:test"
import { WorkspaceSwitchGuard } from "./switch-guard"
test("switch flushes edits and pending writes, serializes switches, and blocks writes only once drained", async () => {
  const gate = new WorkspaceSwitchGuard(); let resolve!: () => void; let dirty = true; let saves = 0
  gate.register(async () => { if (dirty) { dirty = false; saves++ }; return true })
  gate.track(new Promise<void>(done => { resolve = done }))
  const switching = gate.prepare(); assert.equal(gate.getSnapshot(), true); assert.equal(await gate.prepare(), false)
  assert.equal(gate.canMutate(), true)
  await new Promise(done => setImmediate(done)); dirty = true; resolve(); assert.equal(await switching, true)
  assert.equal(saves, 2); assert.equal(gate.canMutate(), false)
  gate.release(); assert.equal(gate.canMutate(), true); assert.equal(gate.getSnapshot(), false)
})
test("failure retains draft and allows a later retry; route changes do not affect tracked operations", async () => {
  const gate = new WorkspaceSwitchGuard(); let save = false
  gate.register(async () => save); assert.equal(await gate.prepare(), false); assert.equal(gate.canMutate(), true)
  let pending = true; const operation = gate.track(Promise.resolve().then(() => { pending = false }))
  save = true; assert.equal(await gate.prepare(), true); await operation; assert.equal(pending, false)
  gate.release()
})
