"use client"

import { IconMail, IconSend } from "@tabler/icons-react"
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
  requestAdminLogin,
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
  const [state, formAction, isPending] = useActionState(requestAdminLogin, {
    ...initialAdminLoginState,
    email: defaultEmail,
  })
  const isInvalid = state.status === "error"
  const isFieldError =
    isInvalid && state.message === "Enter the admin email address."
  const emailValue = state.email || defaultEmail

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />
      <FieldGroup>
        {state.message && !isFieldError ? (
          <Alert variant={isInvalid ? "destructive" : "default"}>
            <IconMail />
            <AlertTitle>{isInvalid ? "Sign-in failed" : "Email sent"}</AlertTitle>
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

        <Button type="submit" disabled={isPending}>
          <IconSend data-icon="inline-start" />
          {isPending ? "Sending" : "Send sign-in link"}
        </Button>
      </FieldGroup>
    </form>
  )
}
