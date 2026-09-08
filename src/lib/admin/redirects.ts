export const ADMIN_HOME_PATH = "/admin"
export const ADMIN_LOGIN_PATH = "/admin/login"

const ADMIN_REDIRECT_ORIGIN = "https://admin-redirect.invalid"

export function getSafeAdminNextPath(value?: string | null) {
  if (!value) return ADMIN_HOME_PATH

  try {
    const target = new URL(value, ADMIN_REDIRECT_ORIGIN)

    if (
      target.origin !== ADMIN_REDIRECT_ORIGIN ||
      target.hash ||
      !isAdminPath(target.pathname) ||
      isAdminLoginPath(target.pathname)
    ) {
      return ADMIN_HOME_PATH
    }

    return `${target.pathname}${target.search}`
  } catch {
    return ADMIN_HOME_PATH
  }
}

export function isAdminLoginPath(pathname: string) {
  return (
    pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)
  )
}

function isAdminPath(pathname: string) {
  return pathname === ADMIN_HOME_PATH || pathname.startsWith(`${ADMIN_HOME_PATH}/`)
}
