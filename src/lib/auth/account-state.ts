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
