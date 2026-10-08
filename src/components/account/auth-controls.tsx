"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useRef, useState } from "react"
import { IconEye, IconEyeOff } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { initialCustomerActionState, type CustomerActionState } from "@/lib/auth/account-state"
import { resendCustomerConfirmation, retryCustomerWorkspace, signOutCustomer } from "@/lib/auth/actions"
import { authPageHref } from "@/lib/auth/redirects"
import { useAccount } from "./account-provider"

export function PasswordControl({ id, name = "password", autoComplete, disabled, invalid, minLength, describedBy }: { id: string; name?: string; autoComplete: "current-password" | "new-password"; disabled?: boolean; invalid?: boolean; minLength?: number; describedBy?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <InputGroup className="bg-background">
      <InputGroupInput id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton aria-label={`${visible ? "Hide" : "Show"} ${name === "confirm-password" ? "password confirmation" : "password"}`} aria-pressed={visible} size="icon-xs" disabled={disabled} onClick={() => setVisible(!visible)}>
          {visible ? <IconEyeOff aria-hidden="true" /> : <IconEye aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export function AuthNotice({ state, id = "auth-message" }: { state: CustomerActionState; id?: string }) {
  if (!state.message) return null
  return state.status === "error" || state.status === "unavailable"
    ? <FieldError id={id} className="break-words">{state.message}</FieldError>
    : <p id={id} role="status" className="text-sm break-words text-muted-foreground">{state.message}</p>
}

export function ConfirmationNotice({ state, next, onEdit }: { state: CustomerActionState; next: string; onEdit?: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const [resend, action, pending] = useActionState(resendCustomerConfirmation, initialCustomerActionState)
  const [now, setNow] = useState(() => Date.now())
  const deadline = Math.max(state.resendAfter || 0, resend.resendAfter || 0)
  useEffect(() => {
    if (deadline <= Date.now()) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [deadline])
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">Check your email</h1>
        <AuthNotice state={state} />
        <p className="text-sm text-muted-foreground">You can sign in with your email and password after confirming. Your profile and company name can wait.</p>
      </div>
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={state.email} />
        <Field>
          <AuthNotice state={resend} id="resend-message" />
          <Button variant="outline" disabled={pending || seconds > 0}>{pending ? "Sending…" : seconds > 0 ? `Resend in ${seconds}s` : "Resend confirmation"}</Button>
        </Field>
      </form>
      {onEdit ? <Button type="button" variant="ghost" onClick={onEdit}>Edit email / back</Button> : <Button variant="ghost" asChild><Link href={authPageHref("/sign-up", next)}>Create account / use another email</Link></Button>}
      <Button asChild><Link href={next}>Continue browsing</Link></Button>
    </div>
  )
}

export function WorkspaceRetry({ next }: { next: string }) {
  const [state, action, pending] = useActionState(retryCustomerWorkspace, initialCustomerActionState)
  return <form action={action} className="flex flex-col gap-2"><input type="hidden" name="next" value={next} /><AuthNotice state={state} id="workspace-message" /><Button variant="outline" disabled={pending}>{pending ? "Preparing workspace…" : "Retry account setup"}</Button></form>
}

export function ContinueBrowsing({ next }: { next: string }) {
  return <FieldDescription className="text-center"><Link href={next}>Continue browsing</Link></FieldDescription>
}

// A working local sign-out entry point before #51 composes the account menu.
export function SessionControls({ next }: { next: string }) {
  const { account, refreshAccount } = useAccount()
  const router = useRouter()
  const [state, action, pending] = useActionState(signOutCustomer, initialCustomerActionState)
  useEffect(() => {
    if (state.status === "success") { refreshAccount(); router.replace(next); router.refresh() }
  }, [state.status, refreshAccount, router, next])
  const user = account.status === "signed-in" || account.status === "unavailable" ? account.user : undefined
  if (!user) return null
  return <form action={action} className="mt-5 flex flex-col gap-2 border-t pt-4">
    <input type="hidden" name="next" value={next} />
    <p className="text-sm break-words text-muted-foreground">Signed in as {user.email}</p>
    <AuthNotice state={state} id="signout-message" />
    <Button variant="outline" disabled={pending}>{pending ? "Signing out…" : "Sign out on this device"}</Button>
  </form>
}
