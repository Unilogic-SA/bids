"use client"

import { useActionState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { requestCustomerRecovery, updateRecoveryPassword } from "@/lib/auth/actions"
import { initialCustomerActionState } from "@/lib/auth/account-state"
import { authPageHref } from "@/lib/auth/redirects"
import { AuthNotice, ContinueBrowsing, PasswordControl } from "./auth-controls"
import { useAccount } from "./account-provider"

export function ForgotPasswordForm({ next, configured, expired }: { next: string; configured: boolean; expired: boolean }) {
  const [state, action, pending] = useActionState(requestCustomerRecovery, initialCustomerActionState)
  return <Card>
    <CardHeader><CardTitle><h1>Reset your password</h1></CardTitle><CardDescription>We’ll email a link so you can choose a new password.</CardDescription></CardHeader>
    <CardContent>
      <form action={action} aria-busy={pending}>
        <input type="hidden" name="next" value={next} />
        <FieldGroup>
          {!configured ? <AuthNotice state={{ status: "unavailable", message: "Password recovery is temporarily unavailable. You can continue browsing.", email: "" }} /> : null}
          {expired && !state.message ? <AuthNotice state={{ status: "error", message: "This recovery link has expired. Request a new one below.", email: "" }} /> : null}
          <AuthNotice state={state} />
          <Field><FieldLabel htmlFor="recovery-email">Email</FieldLabel><Input id="recovery-email" name="email" type="email" autoComplete="email" required disabled={pending || !configured} defaultValue={state.email} /></Field>
          <Button disabled={pending || !configured}>{pending ? "Sending…" : "Send reset link"}</Button>
          <Button asChild variant="ghost"><Link href={authPageHref("/sign-in", next)}>Back to sign in</Link></Button>
          <ContinueBrowsing next={next} />
        </FieldGroup>
      </form>
    </CardContent>
  </Card>
}

export function UpdatePasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(updateRecoveryPassword, initialCustomerActionState)
  const { refreshAccount } = useAccount()
  useEffect(() => { if (state.status === "success") refreshAccount() }, [state.status, refreshAccount])
  return <Card>
    <CardHeader><CardTitle><h1>Choose a new password</h1></CardTitle><CardDescription>Use at least 8 characters.</CardDescription></CardHeader>
    <CardContent><form action={action} aria-busy={pending}><FieldGroup>
      <AuthNotice state={state} />
      {state.status !== "success" ? <><Field><FieldLabel htmlFor="new-password">New password</FieldLabel><PasswordControl id="new-password" autoComplete="new-password" minLength={8} disabled={pending} invalid={state.status === "error"} describedBy={state.message ? "auth-message" : undefined} /></Field><Button disabled={pending}>{pending ? "Updating password…" : "Update password"}</Button></> : null}
      <ContinueBrowsing next={next} />
    </FieldGroup></form></CardContent>
  </Card>
}
