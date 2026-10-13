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

const ACCOUNT_AUTH_PATHS = new Set(["/sign-in", "/sign-up", "/forgot-password", "/account/update-password"])

/** Ordinary listing query changes do not change identity. Auth redirects can. */
export function accountRouteKey(pathname: string, query: string) {
  return ACCOUNT_AUTH_PATHS.has(pathname) && query ? `${pathname}?${query}` : pathname
}
export function accountNavigationRefresh(previous: string, next: string): "none" | "background" | "foreground" {
  if (previous === next) return "none"
  const from = previous.split("?")[0]
  const to = next.split("?")[0]
  return ACCOUNT_AUTH_PATHS.has(from) || ACCOUNT_AUTH_PATHS.has(to) ? "foreground" : "background"
}
