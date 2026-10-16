/** Generate review-only HTML; never sends mail or changes hosted configuration. */
import { mkdirSync, writeFileSync } from "node:fs";
import { emailParagraph, transactionalEmail } from "../src/lib/email/transactional-layout";
import { workspaceInvitationEmail } from "../src/lib/email/invitation-delivery";

const authHref = "{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}";
const definitions = [
  { name: "confirmation", title: "Confirm your email address", action: "Confirm email",
    body: "Confirm your email address to finish setting up your OpenBids account.",
    reassurance: "If you didn’t create an OpenBids account, you can safely ignore this email." },
  { name: "recovery", title: "Reset your password", action: "Reset password",
    body: "We received a request to reset your OpenBids password. Use the button below to choose a new password.",
    reassurance: "If you didn’t request this, you can safely ignore this email. Your password will stay the same." },
];
mkdirSync("supabase/templates", { recursive: true });
mkdirSync("docs/email-previews", { recursive: true });
for (const item of definitions) {
  const html = transactionalEmail({ ...item, body: emailParagraph(item.body), href: authHref });
  writeFileSync(`supabase/templates/${item.name}.html`, html + "\n");
  const href = `https://openbids.example.test/auth/confirm?type=${item.name === "recovery" ? "recovery" : "signup"}&amp;next=%2F&amp;token_hash=synthetic-preview-only`;
  writeFileSync(`docs/email-previews/${item.name}.html`, html.replaceAll(authHref, href) + "\n");
}
writeFileSync("docs/email-previews/invitation.html", workspaceInvitationEmail({
  workspaceName: "Example Procurement Team", inviterName: "Alex Example",
  url: "https://openbids.example.test/invitations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa#token=synthetic-preview-only",
}).html + "\n");
