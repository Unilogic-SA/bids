"use client"

// Generated from official shadcn login-01, radix-nova; see docs/authentication.md.
import Link from "next/link"
import { useActionState, useState } from "react"
import { IconBrandGoogle } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signInCustomer, signInCustomerWithGoogle } from "@/lib/auth/actions"
import { initialCustomerActionState } from "@/lib/auth/account-state"
import { authPageHref } from "@/lib/auth/redirects"
import { AuthNotice, ConfirmationNotice, ContinueBrowsing, PasswordControl, SessionControls, WorkspaceRetry } from "./auth-controls"

export function LoginForm({ next, configured, error = "" }: { next: string; configured: boolean; error?: string }) {
  const [state, action, pending] = useActionState(signInCustomer, initialCustomerActionState)
  const [google, googleAction, googlePending] = useActionState(signInCustomerWithGoogle, initialCustomerActionState)
  const [editing, setEditing] = useState(false)
  const busy = pending || googlePending
  const callbackMessage: Record<string, string> = { callback: "Google sign-in was cancelled or the link expired. Try again.", expired: "This confirmation link has expired. Sign in or request another confirmation.", configuration: "Account access is temporarily unavailable. You can continue browsing.", workspace: "Your account is signed in, but your workspace could not be prepared. Retry account setup or continue browsing." }
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle><h1>Sign in to your account</h1></CardTitle><CardDescription>Use your email and password or continue with Google.</CardDescription></CardHeader>
        <CardContent>
          {state.status === "confirmation" && !editing && !busy ? <ConfirmationNotice state={state} next={next} onEdit={() => setEditing(true)} /> : (
            <form action={action} aria-busy={busy} onSubmit={() => setEditing(false)}>
              <input type="hidden" name="next" value={next} />
              <FieldGroup>
                {!configured ? <AuthNotice state={{ status: "unavailable", email: "", message: "Account access is temporarily unavailable. You can continue browsing." }} /> : <>
                  {callbackMessage[error] && !state.message ? <AuthNotice state={{ status: "error", email: "", message: callbackMessage[error] }} /> : null}
                  <AuthNotice state={state} /><AuthNotice state={google} id="google-message" />
                </>}
                <Field data-invalid={state.status === "error"}>
                  <FieldLabel htmlFor="login-email">Email</FieldLabel>
                  <Input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={state.email} required disabled={busy || !configured} aria-invalid={state.status === "error"} aria-describedby={state.message ? "auth-message" : undefined} />
                </Field>
                <Field data-invalid={state.status === "error"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <FieldLabel htmlFor="login-password">Password</FieldLabel>
                    <Link href={authPageHref("/forgot-password", next)} className="ml-auto inline-block text-sm underline-offset-4 hover:underline">Forgot your password?</Link>
                  </div>
                  <PasswordControl id="login-password" autoComplete="current-password" disabled={busy || !configured} invalid={state.status === "error"} describedBy={state.message ? "auth-message" : undefined} />
                </Field>
                <Field>
                  <Button type="submit" disabled={busy || !configured}>{pending ? "Signing in…" : "Sign in"}</Button>
                  <Button variant="outline" type="submit" formAction={googleAction} formNoValidate disabled={busy || !configured}><IconBrandGoogle aria-hidden="true" />{googlePending ? "Continuing to Google…" : "Sign in with Google"}</Button>
                  <FieldDescription className="text-center">Don’t have an account? <Link href={authPageHref("/sign-up", next)}>Create account</Link></FieldDescription>
                </Field>
                <ContinueBrowsing next={next} />
              </FieldGroup>
            </form>
          )}
          {(error === "workspace" || state.status === "unavailable" && state.email) ? <div className="mt-5"><WorkspaceRetry next={next} /></div> : null}
          <SessionControls next={next} />
        </CardContent>
      </Card>
    </div>
  )
}
