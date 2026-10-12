export type AccountIdentity = { id: string; email: string }
export type AccountSnapshot =
  | { status: "signed-out" }
  | { status: "unavailable"; message: string; user?: AccountIdentity }
  | { status: "signed-in"; user: AccountIdentity; profile: { displayName: string | null }; workspace: { id: string; name: string | null } }
export type AccountState = AccountSnapshot | { status: "loading" }

export type CustomerActionState = {
  status: "idle" | "error" | "confirmation" | "sent" | "unavailable" | "success"
  message: string
  email: string
  resendAfter?: number
}
export const initialCustomerActionState: CustomerActionState = { status: "idle", message: "", email: "" }

export function workspaceLabel(name?: string | null) { return name?.trim() || "Your workspace" }

/** Same-user SDK notifications revalidate without pretending the user signed out. */
export function isSameAccountAuthEvent(event: string, userId: string | undefined, account: AccountState) {
  return ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event) &&
    account.status === "signed-in" && Boolean(userId) && userId === account.user.id
}
