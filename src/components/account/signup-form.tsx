"use client"

// Generated from official shadcn signup-02, radix-nova; see docs/authentication.md.
import Link from "next/link"
import { useActionState, useState } from "react"
import { IconBrandGoogle } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signUpCustomer, signInCustomerWithGoogle } from "@/lib/auth/actions"
import { initialCustomerActionState } from "@/lib/auth/account-state"
import { authPageHref } from "@/lib/auth/redirects"
import { AuthNotice, ConfirmationNotice, ContinueBrowsing, PasswordControl, WorkspaceRetry } from "./auth-controls"

export function SignupForm({ next, configured }: { next: string; configured: boolean }) {
  const [state, action, pending] = useActionState(signUpCustomer, initialCustomerActionState)
  const [google, googleAction, googlePending] = useActionState(signInCustomerWithGoogle, initialCustomerActionState)
  const [editing, setEditing] = useState(false)
  const busy = pending || googlePending
  if (state.status === "confirmation" && !editing && !busy) return <ConfirmationNotice state={state} next={next} onEdit={() => setEditing(true)} />
  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-6" action={action} onSubmit={() => setEditing(false)} aria-busy={busy}>
        <input type="hidden" name="next" value={next} />
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-sm text-balance text-muted-foreground">Start with your email and password. Complete your profile later.</p>
          </div>
          {!configured ? <AuthNotice state={{ status: "unavailable", email: "", message: "Account creation is temporarily unavailable. You can continue browsing." }} /> : <><AuthNotice state={state} /><AuthNotice state={google} id="google-message" /></>}
          <Field data-invalid={state.status === "error"}>
            <FieldLabel htmlFor="signup-email">Email</FieldLabel>
            <Input id="signup-email" name="email" type="email" placeholder="you@example.com" autoComplete="email" defaultValue={state.email} required disabled={busy || !configured} className="bg-background" aria-invalid={state.status === "error"} aria-describedby={state.message ? "auth-message" : undefined} />
            <FieldDescription>We’ll send a link to confirm your email.</FieldDescription>
          </Field>
          <Field data-invalid={state.status === "error"}>
            <FieldLabel htmlFor="signup-password">Password</FieldLabel>
            <PasswordControl id="signup-password" autoComplete="new-password" minLength={8} disabled={busy || !configured} invalid={state.status === "error"} describedBy="signup-password-note" />
            <FieldDescription id="signup-password-note">Use at least 8 characters.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
            <PasswordControl id="confirm-password" name="confirm-password" autoComplete="new-password" minLength={8} disabled={busy || !configured} invalid={state.status === "error"} />
          </Field>
          <Field><Button type="submit" disabled={busy || !configured}>{pending ? "Creating account…" : "Create account"}</Button></Field>
          <FieldSeparator>Or continue with</FieldSeparator>
          <Field>
            <Button variant="outline" type="submit" formAction={googleAction} formNoValidate disabled={busy || !configured}><IconBrandGoogle aria-hidden="true" />{googlePending ? "Continuing to Google…" : "Sign up with Google"}</Button>
            <FieldDescription className="text-center">Already have an account? <Link href={authPageHref("/sign-in", next)}>Sign in</Link></FieldDescription>
          </Field>
          <ContinueBrowsing next={next} />
        </FieldGroup>
      </form>
      {state.status === "unavailable" && state.email ? <WorkspaceRetry next={next} /> : null}
    </div>
  )
}
