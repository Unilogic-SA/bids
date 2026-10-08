import assert from "node:assert/strict"
import { test } from "node:test"
import { credentialsSchema, emailSchema, formString, optionalNameSchema, passwordSchema } from "./validation"

test("email is validated, names are optional and bounded, passwords remain exact", () => {
  assert.equal(emailSchema.parse("  PERSON@example.test "), "person@example.test")
  assert.equal(emailSchema.safeParse("not-email").success, false)
  assert.equal(optionalNameSchema.parse("  Jane  "), "Jane")
  assert.equal(optionalNameSchema.parse("  "), null)
  assert.equal(optionalNameSchema.safeParse("x".repeat(101)).success, false)
  const password = "  pasted pass phrase 🔒  "
  assert.equal(credentialsSchema.parse({ email: "a@example.test", password }).password, password)
  assert.equal(passwordSchema.safeParse("1234567").success, false)
  assert.equal(passwordSchema.parse("x".repeat(10000)).length, 10000)
})
test("file uploads cannot supply a trusted string form value", () => {
  const form = new FormData()
  form.set("password", new Blob(["12345678"]), "file.txt")
  assert.equal(formString(form, "password"), "")
})
