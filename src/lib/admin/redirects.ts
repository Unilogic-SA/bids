export const ADMIN_HOME_PATH = "/admin"
export const ADMIN_LOGIN_PATH = "/admin/login"
const REDIRECT_BASE_URL = "https://admin-redirect.invalid"

export function getSafeAdminNextPath(value?: string | null) {
  const canonicalPath = canonicalizeLocalPath(value)

  if (!canonicalPath || !isPathAtOrBelow(canonicalPath, ADMIN_HOME_PATH)) {
    return ADMIN_HOME_PATH
  }

  if (isPathAtOrBelow(canonicalPath, ADMIN_LOGIN_PATH)) {
    return ADMIN_HOME_PATH
  }

  return canonicalPath
}

function canonicalizeLocalPath(value?: string | null) {
  if (!value?.startsWith("/")) return null

  try {
    const url = new URL(value, REDIRECT_BASE_URL)

    if (url.origin !== REDIRECT_BASE_URL) return null

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

function isPathAtOrBelow(value: string, path: string) {
  if (!value.startsWith(path)) return false

  const boundary = value.charAt(path.length)
  return boundary === "" || boundary === "/" || boundary === "?" || boundary === "#"
}
