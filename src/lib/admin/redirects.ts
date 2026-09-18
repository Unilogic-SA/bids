export const ADMIN_HOME_PATH = "/admin"
export const ADMIN_LOGIN_PATH = "/admin/login"

export function getSafeAdminNextPath(value?: string | null) {
  if (!value || !isPathAtOrBelow(value, ADMIN_HOME_PATH)) {
    return ADMIN_HOME_PATH
  }

  if (isPathAtOrBelow(value, ADMIN_LOGIN_PATH)) {
    return ADMIN_HOME_PATH
  }

  return value
}

function isPathAtOrBelow(value: string, path: string) {
  if (!value.startsWith(path)) return false

  const boundary = value.charAt(path.length)
  return boundary === "" || boundary === "/" || boundary === "?" || boundary === "#"
}
