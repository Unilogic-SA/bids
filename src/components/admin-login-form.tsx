"use client"

import { IconLogin } from "@tabler/icons-react"
import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  type AdminLoginState,
  signInAdmin,
} from "@/lib/admin/actions"

const initialAdminLoginState: AdminLoginState = {
  status: "idle",
  message: "",
  email: "",
}

type AdminLoginFormProps = {
  defaultEmail: string
  next: string
}

export function AdminLoginForm({ defaultEmail, next }: AdminLoginFormProps) {
  const [state, formAction, isPending] = useActionState(signInAdmin, {
    ...initialAdminLoginState,
    email: defaultEmail,
  })
  const isInvalid = state.status === "error"
  const isFieldError = isInvalid && state.message.startsWith("Enter your")
  const emailValue = state.email || defaultEmail

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />
      <FieldGroup>
        {state.message && !isFieldError ? (
          <Alert variant="destructive">
            <IconLogin />
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={isInvalid}>
          <FieldLabel htmlFor="admin-email">Email</FieldLabel>
          <Input
            id="admin-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={emailValue}
            aria-invalid={isInvalid}
            required
          />
          <FieldDescription>
            Use the email address on the admin allowlist.
          </FieldDescription>
          {isFieldError ? <FieldError>{state.message}</FieldError> : null}
        </Field>

        <Field data-invalid={isFieldError}>
          <FieldLabel htmlFor="admin-password">Password</FieldLabel>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={isFieldError}
            required
          />
          <FieldDescription>
            Use the password configured for this Supabase Auth user.
          </FieldDescription>
        </Field>

        <Button type="submit" disabled={isPending}>
          <IconLogin data-icon="inline-start" />
          {isPending ? "Signing in" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  )
}
