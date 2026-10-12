import assert from "node:assert/strict"
import { test } from "node:test"
import { isSameAccountAuthEvent, workspaceLabel, type AccountSnapshot, type AccountState } from "./account-state"
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
test("background focus/token refresh preserves known identity and draft lifetime; switch still clears", async () => {
  const states: AccountState[]=[]
  const pending:Array<(state:AccountSnapshot)=>void>=[]
  const reader=createAccountSnapshotReader(()=>new Promise(resolve=>pending.push(resolve)),state=>states.push(state))
  reader.refresh();await flush();pending[0](A);await flush()
  const before=states.length
  reader.refresh({background:true})
  assert.equal(states.length,before);assert.equal(states.at(-1)?.status,"signed-in")
  await flush();pending[1](A);await flush()
  assert.equal(states.at(-1)?.status,"signed-in")
  reader.refresh();assert.equal(states.at(-1)?.status,"loading")
  await flush();pending[2]({status:"signed-out"});await flush()
  assert.equal(states.at(-1)?.status,"signed-out");reader.dispose()
})
test("background transport outage retains known identity; definitive signout still clears",async()=>{
  const states:AccountState[]=[];let offline=false;let signedOut=false
  const reader=createAccountSnapshotReader(async()=>{if(offline)throw new Error("offline");return signedOut?{status:"signed-out"}:A},state=>states.push(state))
  reader.refresh();await flush();const count=states.length
  offline=true;reader.refresh({background:true});await flush();assert.equal(states.length,count);assert.equal(states.at(-1)?.status,"signed-in")
  offline=false;signedOut=true;reader.refresh({background:true});await flush();assert.equal(states.at(-1)?.status,"signed-out");reader.dispose()
})
test("background unavailable for a different fresh identity clears prior private scope",async()=>{
  const states:AccountState[]=[];let switched=false
  const reader=createAccountSnapshotReader(async()=>switched?{status:"unavailable",user:{id:"B",email:"b@example.test"},message:"Workspace unavailable"}:A,state=>states.push(state))
  reader.refresh();await flush();switched=true;reader.refresh({background:true});await flush()
  assert.equal(states.at(-1)?.status,"unavailable");assert.equal((states.at(-1) as {user:{id:string}}).user.id,"B");reader.dispose()
})
test("coalesced foreground then background failure cannot retain loading using stale identity",async()=>{
  const states:AccountState[]=[];let offline=false
  const reader=createAccountSnapshotReader(async()=>{if(offline)throw new Error("offline");return A},state=>states.push(state))
  reader.refresh();await flush();offline=true;reader.refresh();reader.refresh({background:true});await flush()
  assert.equal(states.at(-1)?.status,"unavailable");reader.dispose()
})


test("refocus SIGNED_IN and same-user updates keep the verified shell; sign-out and identity changes clear it", async () => {
  const states: AccountState[] = []
  let result: AccountSnapshot = A
  const reader = createAccountSnapshotReader(async () => result, state => states.push(state))
  reader.refresh(); await flush()
  for (const event of ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"]) {
    const before = states.length
    assert.equal(isSameAccountAuthEvent(event, "A", states.at(-1)!), true)
    reader.refresh({ background: isSameAccountAuthEvent(event, "A", states.at(-1)!) })
    assert.equal(states.length, before)
    await flush()
    assert.equal(states.at(-1)?.status, "signed-in")
  }
  for (const event of ["SIGNED_OUT", "PASSWORD_RECOVERY"]) assert.equal(isSameAccountAuthEvent(event, "A", A), false)
  assert.equal(isSameAccountAuthEvent("SIGNED_IN", "B", A), false)
  assert.equal(isSameAccountAuthEvent("TOKEN_REFRESHED", undefined, A), false)
  assert.equal(isSameAccountAuthEvent("SIGNED_IN", "A", { status: "loading" }), false)
  result = { status: "signed-out" }
  reader.refresh({ background: isSameAccountAuthEvent("SIGNED_OUT", undefined, A) })
  assert.equal(states.at(-1)?.status, "loading")
  await flush()
  assert.equal(states.at(-1)?.status, "signed-out")
  reader.dispose()
})
