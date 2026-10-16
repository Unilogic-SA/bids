import { emailParagraph, escapeHtml, transactionalEmail } from "./transactional-layout";

export function workspaceInvitationEmail(input: {
  workspaceName: string;
  inviterName: string;
  url: string;
}) {
  const title = `${input.inviterName} invited you to ${input.workspaceName}`;
  const detail =
    "Join to work together on all existing and future saved bids, checklists and submission records in this workspace. Your other workspaces stay private. This invitation expires in seven days.";
  return {
    subject: "You're invited to an OpenBids workspace",
    text: `${title}\n\n${detail}\n\nReview invitation: ${input.url}\n\nSign in with the email address this invitation was sent to. Joining requires your explicit acceptance.`,
    html: transactionalEmail({
      title: "You're invited to a workspace",
      body: emailParagraph(`${escapeHtml(input.inviterName)} invited you to <strong style="font-weight:600;color:#171717;">${escapeHtml(input.workspaceName)}</strong>.`)
        + emailParagraph(detail),
      action: "Review invitation",
      href: escapeHtml(input.url),
      reassurance: "Sign in with the email address this invitation was sent to. Joining requires your explicit acceptance.",
    }),
  };
}
export type EmailOutcome = {
  status: "sent" | "failed" | "unknown";
  providerId?: string;
  code?:
    | "transport"
    | "timeout"
    | "rejected"
    | "rate_limit"
    | "provider"
    | "configuration";
};
/** One immutable payload/idempotency key per reserved send generation. */
export async function sendWorkspaceInvitation(
  input: {
    email: string;
    id: string;
    sendVersion: number;
    workspaceName: string;
    inviterName: string;
    url: string;
  },
  transport: typeof fetch = fetch,
): Promise<EmailOutcome> {
  const key = process.env.RESEND_API_KEY,
    from = process.env.WORKSPACE_INVITE_FROM;
  if (!key || !from) return { status: "failed", code: "configuration" };
  const body = JSON.stringify({
    from,
    to: [input.email],
    ...workspaceInvitationEmail(input),
  });
  const deadline = Date.now() + 12000;
  let outcome: EmailOutcome = { status: "unknown", code: "transport" };
  for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
    try {
      const response = await transport("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `workspace-invite/${input.id}/${input.sendVersion}`,
        },
        body,
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(4000, deadline - Date.now())),
        ),
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        return typeof data?.id === "string"
          ? { status: "sent", providerId: data.id }
          : { status: "unknown", code: "provider" };
      }
      if (response.status !== 429 && response.status < 500)
        return { status: "failed", code: "rejected" };
      outcome = {
        status: response.status === 429 ? "failed" : "unknown",
        code: response.status === 429 ? "rate_limit" : "provider",
      };
      const header = response.headers.get("retry-after");
      const seconds = Number(header);
      const delay = header
        ? Number.isFinite(seconds)
          ? seconds * 1000
          : Date.parse(header) - Date.now()
        : 250 * (attempt + 1);
      if (delay > deadline - Date.now() || delay > 3000) return outcome;
      if (attempt < 2)
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
    } catch (error) {
      outcome = {
        status: "unknown",
        code:
          error instanceof Error &&
          ["TimeoutError", "AbortError"].includes(error.name)
            ? "timeout"
            : "transport",
      };
    }
  }
  return outcome;
}
