"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerAuthClient, hasSupabasePublicConfig } from "@/lib/supabase/server"
import type { CustomerActionState } from "./account-state"
import { runCustomerFlow } from "./flows"
import { getSafePublicNextPath } from "./redirects"
import { formString, passwordSchema } from "./validation"
import { ensureCustomerWorkspace, isVerifiedCustomer } from "./workspace"
import { readRecoveryProof, RECOVERY_COOKIE } from "./recovery"

async function perform(kind: Parameters<typeof runCustomerFlow>[0], form: FormData): Promise<CustomerActionState> {
  if (!hasSupabasePublicConfig()) return { status: "unavailable", message: "Account access is temporarily unavailable. You can continue browsing.", email: "" }
  const supabase = await createServerAuthClient()
  const result = await runCustomerFlow(kind, {
    email: formString(form, "email"), password: formString(form, "password"),
    confirmation: formString(form, "confirm-password"), next: getSafePublicNextPath(formString(form, "next")),
  }, { auth: supabase.auth, bootstrap: ensureCustomerWorkspace })
  if (kind === "signout" && result.redirect) {
    (await cookies()).set(RECOVERY_COOKIE, "", { path: "/account/update-password", maxAge: 0, httpOnly: true, sameSite: "lax" })
    return result.state
  }
  if (result.redirect) redirect(result.redirect)
  return result.state
}

export async function signUpCustomer(_state: CustomerActionState, form: FormData) { return perform("signup", form) }
export async function signInCustomer(_state: CustomerActionState, form: FormData) { return perform("signin", form) }
export async function resendCustomerConfirmation(_state: CustomerActionState, form: FormData) { return perform("resend", form) }
export async function requestCustomerRecovery(_state: CustomerActionState, form: FormData) {
  if (!process.env.CUSTOMER_AUTH_RECOVERY_SECRET || Buffer.byteLength(process.env.CUSTOMER_AUTH_RECOVERY_SECRET) < 32) {
    return { status: "unavailable", message: "Password recovery is temporarily unavailable. Try again later.", email: "" } satisfies CustomerActionState
  }
  return perform("forgot", form)
}
export async function signInCustomerWithGoogle(_state: CustomerActionState, form: FormData) { return perform("google", form) }
export async function retryCustomerWorkspace(_state: CustomerActionState, form: FormData) { return perform("retry", form) }
export async function signOutCustomer(_state: CustomerActionState, form: FormData) { return perform("signout", form) }

export async function updateRecoveryPassword(_state: CustomerActionState, form: FormData): Promise<CustomerActionState> {
  const failure = (message: string): CustomerActionState => ({ status: "error", message, email: "" })
  if (!hasSupabasePublicConfig()) return failure("Password recovery is temporarily unavailable.")
  const password = passwordSchema.safeParse(formString(form, "password"))
  if (!password.success) return failure(password.error.issues[0].message)
  const supabase = await createServerAuthClient()
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    const claims = await supabase.auth.getClaims()
    const store = await cookies()
    const proof = isVerifiedCustomer(user) && !error && !claims.error && claims.data?.claims.sub === user.id
      ? readRecoveryProof(store.get(RECOVERY_COOKIE)?.value, user.id, claims.data.claims.session_id) : null
    if (!proof || !isVerifiedCustomer(user)) return failure("This recovery link has expired. Request a new password reset email.")
    const updated = await supabase.auth.updateUser({ password: password.data })
    if (updated.error) return failure("Your password could not be updated. Check the password requirements and try again.")
    // Keep the bounded proof until navigation/expiry: deleting it here would
    // make Next's action rerender redirect before success feedback is shown.
    // Workspace failures do not undo password recovery or invalidate the session.
    await ensureCustomerWorkspace(user).catch(() => false)
    return { status: "success", message: "Your password has been updated. You can continue browsing.", email: "" }
  } catch { return failure("Your password could not be updated. Please try again.") }
}
