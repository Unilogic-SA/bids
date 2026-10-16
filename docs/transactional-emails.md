# Transactional email presentation

## Scope and source of truth

Presentation only for existing confirmation, recovery and workspace invitation
emails. No new delivery logic, dependencies, auth flows or configuration changes.
`src/lib/email/transactional-layout.ts` owns the common shell;
`node --import tsx scripts/preview-emails.ts` regenerates the two paste-ready
Supabase templates and three synthetic HTML previews. Commit regenerated files
with any future shell change. Do not send the preview files.

The existing `globals.css` primary (`oklch(0.491 0.27 292.581)`) is represented
by its email-safe sRGB equivalent `#6d28d9`. White background, dark text,
accessible neutral secondary copy, 552px container, 24px effective mobile inset,
28px headings, 16px body, 14px secondary text, 12px footer, 7px button radius.
Inter/Figtree are preferred when available; Arial/Helvetica/sans-serif are local
fallbacks. No remote fonts, tracking, images, Tailwind or application components.

## Code versus hosted configuration

- Invitation HTML changes in `src/lib/email/invitation-delivery.ts`; sender,
  recipient, subject, URL, plain text and the entire send function are unchanged.
- `supabase/templates/confirmation.html`: proposed **Confirm signup** body.
- `supabase/templates/recovery.html`: proposed **Reset password** body.
- Neither hosted Supabase template was edited. There is no checked-in
  `supabase/config.toml` email configuration; these files do not activate
  themselves on app deployment.
- Hosted source could not be freshly inspected because the connected browser
  returned `UNAVAILABLE` (session closed). Existing production-template evidence
  is recorded in `docs/authentication.md`, not a new dashboard observation.

After approval, compare the current hosted bodies against that recorded link
expression, then paste only the corresponding HTML body into Supabase
Authentication → Email Templates. Keep subjects, SMTP, redirect settings and
all other email types unchanged. Save the previous bodies for rollback. If the
hosted expressions differ, preserve them and review that discrepancy separately
before applying; do not substitute a new token flow.

## Link-format inspection (separate finding)

Both proposed Auth bodies preserve exactly:

```html
{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}
```

`customerCallbackUrl` already constructs `/auth/confirm?next=...&type=signup`
or `type=recovery`; `flows.ts` supplies it for signup, resend and recovery.
Appending `&amp;token_hash=` is appropriate for these URLs. A `.RedirectTo`
without an existing query, including a provider fallback to Site URL, would
produce a malformed link. No routing defect was found in the repository's
current callers; hosted source/fallback behaviour remains unverified. No routing,
variables, encoding, token handling or redirects were changed.

## Preview and verification — 16 October 2026

| Email | Desktop (800px viewport) | Mobile (320px viewport) |
| --- | --- | --- |
| Confirmation | [PNG](email-previews/confirmation-desktop.png) · [HTML](email-previews/confirmation.html) | [PNG](email-previews/confirmation-mobile.png) |
| Recovery | [PNG](email-previews/recovery-desktop.png) · [HTML](email-previews/recovery.html) | [PNG](email-previews/recovery-mobile.png) |
| Invitation | [PNG](email-previews/invitation-desktop.png) · [HTML](email-previews/invitation.html) | [PNG](email-previews/invitation-mobile.png) |

All six Chromium renders were visually inspected. No horizontal overflow;
container measured 552px desktop / 288px mobile. Each email has one visible
anchor, verified as an actionable hit target and keyboard-focusable. CTA height
is 50px. Synthetic URLs retain the correct parameters/fragments; navigation was
not performed. Screenshots use installed system font fallbacks. No real tokens,
addresses or production records were used.

- `npm ci --no-audit --no-fund`: passed.
- `npm test`: 204 passed, including existing HTML escaping, seven-day expiry,
  explicit acceptance, privacy, identical retry payload and idempotency checks.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `git diff --check`: passed.
- Impeccable distill/polish applied: one action, no decorative containers,
  consistent hierarchy, spacing, quiet footer and mobile wrapping. Detector
  reports 7 font warnings / 19 palette advisories across generated copies;
  intentionally retained incumbent Inter/Arial and email-safe literal sRGB
  values. No design-system files were changed.
- Body, secondary and button text exceed WCAG AA contrast against their surfaces.
- Invitation plain text is byte-for-byte unchanged and readable. Supabase owns
  Auth MIME generation; there is no separately configured text body in this repo.
  Actual Auth plain-text MIME output remains unverified.

### Compatibility and remaining verification

Tables with `role=presentation`, inline styles, explicit white background,
standard fonts, fixed Outlook desktop wrapper and MSO button spacing support
email clients without modern layout CSS. Outlook may show square button corners.
No Gmail or Outlook inbox tests were run; Chromium previews are not evidence of
native mail-client rendering. Live invitation delivery remains **unverified**.
Auth delivery/cross-device confirmation/recovery remain **unverified**. No live
test emails were sent, no merge or deployment was performed, and no production
configuration was changed. Controlled inbox tests require a separately approved
recipient and follow-up after template application.

Supabase reference: https://supabase.com/docs/guides/local-development/customizing-email-templates
(hosted templates are applied via Dashboard, not local configuration).
