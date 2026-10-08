import { z } from "zod"

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."))
export const passwordSchema = z.string().min(8, "Use at least 8 characters.")
export const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema })
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.") })
export const optionalNameSchema = z.string().trim().max(100, "Use no more than 100 characters.").transform(value => value || null)

export function formString(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === "string" ? value : ""
}
