import type { AccountState } from "./account-state"
/** An awaited draft flush must never publish over a newer auth/account result. */
export class AccountTransition {
  private epoch = 0
  private confirmed: AccountState = { status: "loading" }
  constructor(private publish: (state: AccountState) => void, private guards: () => Iterable<() => Promise<boolean>>) {}
  current() { return this.confirmed }
  dispose() { this.epoch++ }
  async accept(state: AccountState) {
    const epoch = ++this.epoch
    const previous = this.confirmed
    const switching = previous.status === "signed-in" && state.status === "signed-in" && previous.user.id === state.user.id && previous.workspace.id !== state.workspace.id && state.workspaces.some(workspace => workspace.id === previous.workspace.id)
    if (switching) for (const guard of this.guards()) {
      if (!await guard() || epoch !== this.epoch) return
    }
    if (epoch !== this.epoch) return
    this.confirmed = state
    this.publish(state)
  }
}
