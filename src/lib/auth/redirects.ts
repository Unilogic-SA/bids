const PUBLIC_BASE = "https://public-redirect.invalid"

/** A small allowlist, rather than an open redirect with a blacklist. */
export function getSafePublicNextPath(value?: string | null) {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\s\u0000-\u001f\u007f]/.test(value)) return "/"
  const rawPath = value.split(/[?#]/)[0]
  if (rawPath.includes("%") || rawPath.includes("//") || /(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath)) return "/"
  try {
    const url = new URL(value, PUBLIC_BASE)
    if (url.origin !== PUBLIC_BASE) return "/"
    const path = url.pathname
    // Reject encoded path separators, dot segments, and repeated encoding.
    const decoded = decodeURIComponent(path)
    if (decoded !== path || path.includes("//")) return "/"
    if (path === "/" || path === "/account/settings" || /^\/tenders\/[A-Za-z0-9_-]+$/.test(path)) {
      return `${path}${url.search}${url.hash}`
    }
  } catch { /* Invalid URL or percent encoding. */ }
  return "/"
}

export function authPageHref(path: "/sign-in" | "/sign-up" | "/forgot-password", next?: string | null) {
  return `${path}?next=${encodeURIComponent(getSafePublicNextPath(next))}`
}

export function getTrustedAuthOrigin(value = process.env.CUSTOMER_AUTH_SITE_URL) {
  if (!value) throw new Error("Customer authentication origin is not configured.")
  const url = new URL(value)
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("Customer authentication requires a trusted site origin.")
  }
  return url.origin
}

export function customerCallbackUrl(kind: "oauth" | "signup" | "recovery" | "email_change", next?: string | null) {
  const url = new URL(kind === "oauth" ? "/auth/customer/callback" : "/auth/confirm", getTrustedAuthOrigin())
  url.searchParams.set("next", getSafePublicNextPath(next))
  if (kind !== "oauth") url.searchParams.set("type", kind)
  return url.toString()
}
