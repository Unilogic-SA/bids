import { cookies } from "next/headers"
export { resolveWorkspace } from "./account-state"

export const SELECTED_WORKSPACE_COOKIE = "openbids-workspace"
export const workspaceCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 }
export async function selectWorkspaceCookie(id: string) { (await cookies()).set(SELECTED_WORKSPACE_COOKIE, id, workspaceCookieOptions) }
