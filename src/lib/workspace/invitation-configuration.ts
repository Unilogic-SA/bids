/** Server configuration is represented as a boolean in the account snapshot. */
export function invitationsEnabled() {
  return process.env.WORKSPACE_INVITATIONS_ENABLED === "true" && Boolean(process.env.RESEND_API_KEY && process.env.WORKSPACE_INVITE_FROM && process.env.CUSTOMER_AUTH_SITE_URL)
}
