import assert from "node:assert/strict"
import { test } from "node:test"
import { authPageHref, getSafePublicNextPath, getTrustedAuthOrigin } from "./redirects"

test("public return paths retain only actual public destinations and their query/fragment", () => {
  for (const path of ["/", "/?q=office&page=2#result-4", "/tenders/ocds-123_456?from=%2F%3Fq%3Dchairs#documents", "/account/settings?section=profile#company"]) assert.equal(getSafePublicNextPath(path), path)
  assert.equal(authPageHref("/sign-up", "/?q=x#result-1"), "/sign-up?next=%2F%3Fq%3Dx%23result-1")
})
test("public returns reject malicious origins, path encodings, lookalikes and loops", () => {
  for (const path of [undefined, "", "https://evil.test", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/%5cevil.test", "/%252fadmin", "/tenders/%2e%2e/admin", "/tenders/one/calendar", "/tenders/", "/tendersx/one", "/admin", "/admin/login", "/api/account/session", "/auth/confirm", "/sign-in", "/sign-up", "/forgot-password", "/account/update-password", "/account/settings-extra", "/account/settings/extra", "/tenders/one%00", "/tenders/one%ZZ", "/tenders/one\n"]) assert.equal(getSafePublicNextPath(path), "/", String(path))
})
test("trusted callback origin never comes from forwarded hosts", () => {
  assert.equal(getTrustedAuthOrigin("https://preview.example.test"), "https://preview.example.test")
  assert.equal(getTrustedAuthOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000")
  for (const value of ["https://user:password@example.test", "https://example.test/path", "http://example.test", "https://example.test?next=x", "https://example.test#x", "//example.test"]) assert.throws(() => getTrustedAuthOrigin(value))
})

test("URL canonicalization cannot hide encoded path confusion", () => {
  for (const path of ["/auth/%2e%2e/tenders/one", "/auth/../tenders/one", "/%2e/tenders/one", "/tenders/one//", "/tenders/one%2f"]) assert.equal(getSafePublicNextPath(path), "/")
})
