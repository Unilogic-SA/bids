import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { CustomerActionState } from "./account-state"
import { customerCallbackUrl, getSafePublicNextPath } from "./redirects"
import { credentialsSchema, emailSchema, signInSchema } from "./validation"
import { isVerifiedCustomer } from "./workspace"

type CustomerAuth = Pick<SupabaseClient["auth"], "signUp" | "signInWithPassword" | "getUser" | "resend" | "resetPasswordForEmail" | "signInWithOAuth" | "exchangeCodeForSession" | "verifyOtp" | "signOut">
export type FlowDependencies = { auth: CustomerAuth; bootstrap: (user: User) => Promise<boolean>; callbackUrl?: typeof customerCallbackUrl }
export type FlowResult = { state: CustomerActionState; redirect?: string }
export const workspaceFailure = "Your account is signed in, but your workspace could not be prepared. Retry account setup or continue browsing."
const unavailable = (): FlowResult => ({ state: { status: "unavailable", message: "Account access is temporarily unavailable. Try again or continue browsing.", email: "" } })
const failure = (message: string, email = ""): FlowResult => ({ state: { status: "error", message, email } })
const checkEmail = (email: string): FlowResult => ({ state: { status: "confirmation", message: "Check your email. If confirmation is needed, a link will arrive shortly. You can continue browsing while you wait.", email, resendAfter: Date.now() + 60_000 } })

export async function finishCustomerLogin(deps: FlowDependencies, next: string): Promise<FlowResult> {
  const { data: { user }, error } = await deps.auth.getUser()
  if (error || !isVerifiedCustomer(user)) return failure("Sign in again to continue.")
  try {
    if (!await deps.bootstrap(user)) return { state: { status: "unavailable", message: workspaceFailure, email: user.email! } }
  } catch { return { state: { status: "unavailable", message: workspaceFailure, email: user.email! } } }
  return { state: { status: "success", message: "Signed in.", email: "" }, redirect: getSafePublicNextPath(next) }
}

export async function runCustomerFlow(kind: "signup" | "signin" | "resend" | "forgot" | "google" | "retry" | "signout", input: { email?: string; password?: string; confirmation?: string; next: string }, deps: FlowDependencies): Promise<FlowResult> {
  const next = getSafePublicNextPath(input.next)
  const callback = deps.callbackUrl ?? customerCallbackUrl
  try {
    if (kind === "retry") return await finishCustomerLogin(deps, next)
    if (kind === "signout") {
      const { error } = await deps.auth.signOut({ scope: "local" })
      return error ? failure("Sign out failed. Try again.") : { state: { status: "success", message: "Signed out.", email: "" }, redirect: next }
    }
    if (kind === "google") {
      const { data, error } = await deps.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback("oauth", next), skipBrowserRedirect: true, scopes: "openid email profile" } })
      if (error || !data.url) return failure("Google sign-in is unavailable. Try email and password.")
      return { state: { status: "success", message: "Continuing to Google.", email: "" }, redirect: data.url }
    }
    const parsed = (kind === "signup" ? credentialsSchema : kind === "signin" ? signInSchema : emailSchema).safeParse(kind === "signup" || kind === "signin" ? { email: input.email, password: input.password } : input.email)
    if (!parsed.success) return failure(parsed.error.issues[0].message, input.email?.trim() || "")
    const email = typeof parsed.data === "string" ? parsed.data : parsed.data.email
    if (kind === "forgot") {
      const { error } = await deps.auth.resetPasswordForEmail(email, { redirectTo: callback("recovery", next) })
      if (error && error.status === 429) return failure("Too many requests. Wait a minute before trying again.", email)
      if (error && error.code !== "user_not_found") return failure("We could not send a recovery email. Please try again later.", email)
      return { state: { status: "sent", message: "If an account uses this email, a password reset link will arrive shortly.", email, resendAfter: Date.now() + 60_000 } }
    }
    if (kind === "resend") {
      const { error } = await deps.auth.resend({ type: "signup", email, options: { emailRedirectTo: callback("signup", next) } })
      if (error && error.status === 429) return failure("Too many requests. Wait a minute before trying again.", email)
      if (error && !["user_not_found", "email_already_confirmed"].includes(error.code || "")) return failure("We could not send a confirmation email. Please try again later.", email)
      return checkEmail(email)
    }
    if (kind === "signup") {
      if (input.confirmation !== input.password) return failure("The passwords do not match.", email)
      const { data, error } = await deps.auth.signUp({ email, password: input.password!, options: { emailRedirectTo: callback("signup", next) } })
      if (error && error.status === 429) return failure("Too many requests. Wait a minute before trying again.", email)
      if (error && !["user_already_exists", "email_exists"].includes(error.code || "")) return failure("We could not create an account. Please try again later.", email)
      // Email confirmation must remain enabled; never treat immediate signup as verified login.
      if (data.session) {
        await deps.auth.signOut({ scope: "local" })
        return unavailable()
      }
      return checkEmail(email)
    }
    const { error } = await deps.auth.signInWithPassword({ email, password: input.password! })
    if (error?.code === "email_not_confirmed") return checkEmail(email)
    if (error) return failure(error.status === 429 ? "Too many attempts. Wait before trying again." : "The email or password is incorrect.", email)
    return await finishCustomerLogin(deps, next)
  } catch { return unavailable() }
}

export function parseConfirmation(url: URL) {
  const type = url.searchParams.get("type")
  const token = url.searchParams.get("token_hash")
  if (!token || !/^[a-fA-F0-9]{32,128}$/.test(token) || !["signup", "recovery", "email_change"].includes(type || "")) return null
  return { type: type as "signup" | "recovery" | "email_change", token_hash: token, next: getSafePublicNextPath(url.searchParams.get("next")) }
}

export async function completeCustomerCallback(url: URL, deps: FlowDependencies): Promise<FlowResult> {
  const next = getSafePublicNextPath(url.searchParams.get("next"))
  if (url.searchParams.has("error") || !url.searchParams.get("code")) return failure("Google sign-in was cancelled or the link expired. Please try again.")
  try {
    const { error } = await deps.auth.exchangeCodeForSession(url.searchParams.get("code")!)
    if (error) return failure("This sign-in link has expired. Please try again.")
    return await finishCustomerLogin(deps, next)
  } catch { return unavailable() }
}
