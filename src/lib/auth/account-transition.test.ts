import assert from "node:assert/strict"
import { test } from "node:test"
import { AccountTransition } from "./account-transition"
import type { AccountState, AccountWorkspace } from "./account-state"
const a = { id: "one", name: "One", role: "owner" as const }, b = { id: "two", name: "Two", role: "member" as const }
const account = (id = "A", workspace: AccountWorkspace = a): AccountState => ({ status: "signed-in", user: { id, email: `${id}@example.test` }, profile: { displayName: id }, workspace, workspaces: [a, b], invitationsEnabled: false })
test("late draft flush cannot resurrect old account after signout or another identity", async () => {
  for (const replacement of [{ status: "signed-out" } as AccountState, account("B")]) {
    const states: AccountState[] = []; let resolve!: (result: boolean) => void
    const transition = new AccountTransition(state => states.push(state), () => [() => new Promise(done => { resolve = done })])
    await transition.accept(account())
    const switchPromise = transition.accept(account("A", b))
    await transition.accept(replacement)
    resolve(true); await switchPromise
    assert.deepEqual(states.at(-1), replacement)
  }
})
test("failed flush keeps original workspace, but removed membership clears stale scope", async () => {
  const states: AccountState[] = []
  const transition = new AccountTransition(state => states.push(state), () => [async () => false])
  await transition.accept(account()); await transition.accept(account("A", b)); assert.deepEqual(states.at(-1), account())
  const removed = { ...account("A", b), workspaces: [b] } as AccountState
  await transition.accept(removed); assert.deepEqual(states.at(-1), removed)
})
