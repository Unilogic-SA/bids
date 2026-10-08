# Customer authentication foundation (#49)

This implements steps 1–3 of [master #48](https://github.com/Unilogic-SA/bids/issues/48).
Browsing, tender filters/details/documents/calendar actions and existing device
bookmarks remain public. Profile/company completion is optional. Settings,
email/password management outside recovery, global sign-out, account deletion,
and account menu/prompt composition belong to #50/#51. The customer foundation
provides a local sign-out control on `/sign-in` pending the #51 menu.

## Official block provenance

Fetched and installed on 8 October 2026 using the existing `components.json`:
`radix-nova`, Radix primitives, CSS variables, neutral base and Tabler icons.
The latest installer was shadcn **4.21.4**; application dependencies were not
upgraded. These are implementation sources, not visual references:

| Route | Official source | Source JSON SHA-256 |
| --- | --- | --- |
| `/sign-up` | [signup-02](https://ui.shadcn.com/r/styles/radix-nova/signup-02.json) | `d5dfe9593ee4c5dd53464357998b113753034c4bbf84fe58f5f2da0c55074ab4` |
| `/sign-in` | [login-01](https://ui.shadcn.com/r/styles/radix-nova/login-01.json) | `0a831fa6211bd5807c41bfa8e366bc61816659ea90a87a5d89c98a1a9f56eb16` |

Inspected current official source and CLI help, then ran:

```sh
npx shadcn@latest add signup-02 --dry-run
npx shadcn@latest add login-01 --dry-run
npx shadcn@latest add signup-02
npx shadcn@latest add login-01
```

The installer proposed an existing Field overwrite, which was declined; all
installed primitives and tokens are preserved. Generated pages were moved from
`signup`/`login` to `/sign-up`/`/sign-in`, and generated forms into
`src/components/account`. No duplicate template routes remain.

Signup retains the responsive two-column form/cover page, `max-w-xs` form,
FieldGroup hierarchy, password confirmation present in the official source,
and social-auth separator. The sample full-name requirement was removed; only
email/password and password confirmation are required. GitHub was replaced by
Google. The shared OpenBids header replaces the sample brand row. The existing
`public/file.svg` document asset replaces the placeholder image in the desktop
cover, with OpenBids procurement copy; no new illustration dependency or project.
The cover remains hidden below `lg`. Login retains the centred `max-w-sm` Card,
CardHeader/CardContent, email/password fields, recovery link and social action.
Both account for the existing header height, use one shared provider, add
accessible password visibility/autocomplete, inline feedback, pending controls
and safe cross-links. Recovery and confirmation use installed shadcn primitives.

## Environment inspection and prerequisites

Before implementation, the existing configured Supabase endpoint responded to a
read-only public `/auth/v1/settings` request. Email signup was enabled, email
confirmation was enabled (`mailer_autoconfirm=false`), and Google was disabled.
Public URL/key variables were present. Service-role and trusted customer-origin
configuration were absent. Available cloud metadata did not establish that the
project was isolated for development/Preview. No hosted writes, provider signup,
migrations or production configuration changes were performed.

Complete this checklist in a **dedicated non-production Supabase project** and
Vercel Preview configuration before provider/end-to-end verification. Do not
copy privileged production credentials into development/Preview:

- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to that
  project. These are public browser settings, not privileged credentials.
- Supply that project's server-only `SUPABASE_SERVICE_ROLE_KEY` (existing
  `SUPABASE_SECRET_KEY` fallback is supported) securely for workspace bootstrap.
  It is not imported into browser client code or used for ordinary profile reads.
- Set server-only `CUSTOMER_AUTH_SITE_URL` to the exact trusted origin of each
  environment. There is deliberately no fallback to request/forwarded hosts or
  the existing production SEO URL. Use one consistent local host, e.g.
  `http://localhost:3000`; local browser verification used `127.0.0.1:3000`.
- Supply a separate server-only, cryptographically random
  `CUSTOMER_AUTH_RECOVERY_SECRET` of at least 32 bytes through secure environment
  settings. It must be an actual locally usable secret, not a proxy-only
  credential placeholder. Never commit/print it or reuse a production value.
- Apply only `supabase/migrations/20261008124213_customer_accounts.sql` and its
  required baseline dependencies to the isolated project using the normal CLI.
  Inspect actual grants/RLS and Supabase database advisors there. CLI 2.120.0
  generated this filename with `supabase migration new customer_accounts`;
  `SUPABASE_HOME` was directed to ignored `.tools/supabase` because the default
  home directory was read-only. No handwritten migration timestamp.
- Keep email confirmation enabled. Set minimum password length to 8, with no
  additional character-class requirements for this initial policy. Passwords
  are never trimmed, echoed in returned state, or restricted to an arbitrary
  maximum; paste/password managers/autocomplete remain usable.
- Enable Google in the isolated Supabase Auth provider settings with a dedicated
  test OAuth client. Only basic identity scopes (`openid email profile`) are
  requested, never calendar access. Supabase's automatic verified same-email
  identity linking is used; different-email accounts are not manually merged.
- Set secure email-change confirmation for the later #50 flow. This foundation's
  confirmation handler accepts `signup`, `recovery`, `email_change` only; magic
  links, arbitrary email OTP login, invites and SMS are not supported.

## Callback destinations and email templates

For **each** local/stable Preview origin, configure Supabase's Auth Site URL and
explicit redirect allowlist for `/auth/customer/callback` and `/auth/confirm`
including their safe `next` and fixed `type` query parameters. Configure the
Google OAuth client with the **Supabase** provider callback
`https://<development-project>.supabase.co/auth/v1/callback`. This is distinct
from the application's return route `/auth/customer/callback`.

Use a stable non-production Preview origin, or a carefully scoped pattern for
this Vercel project only; never accept arbitrary hosts. Build separate production
origins/allowlists only in a later owner-authorized release. This PR does not
change hosted configuration. `CUSTOMER_AUTH_SITE_URL` must match the deployed
origin, including scheme/port, and match the browser origin for session cookies.

The application supplies `.RedirectTo` as a complete trusted confirmation URL
with `type` and encoded safe `next`. Templates append only the token hash:

```html
<!-- Confirm signup: .RedirectTo already includes type=signup and next -->
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Confirm email</a>

<!-- Reset password: .RedirectTo already includes type=recovery and next -->
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Reset password</a>

<!-- Email change, when #50 sends type=email_change to this handler -->
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Confirm email change</a>
```

`verifyOtp({token_hash,type})` works without the device's original PKCE verifier
for these email links. Google uses PKCE separately. Consumed links redirect to
clean URLs with `Referrer-Policy: no-referrer` and private/no-store responses.
Handlers render no analytics-bearing page with auth tokens. Never capture real
auth query strings in screenshots, analytics or logs; sanitize them at the
hosting/logging layer as well. If a test mail scanner consumes single-use links,
use Supabase's documented explicit confirmation interaction, not disabled email
verification or an alternate login method.

Supabase owns token validation and sends email through **SMTP**. For Resend:
verify a non-production sending domain; configure host/port/sender and SMTP
credentials securely in Supabase settings. Add appropriate SPF/DKIM/DMARC,
disable link tracking that rewrites security links, and send minimal operational
email copy. No `RESEND_API_KEY` is needed in this app/browser just for SMTP.
Configure sensible Supabase server-side email/auth rate limits and resend
intervals. The 60-second UI resend cooldown is feedback, not the rate-limit
security boundary. If hosted signup requires CAPTCHA, add and verify the official
supported provider/token integration before enabling that configuration; this
foundation does not bypass CAPTCHA and provider rejection fails safely inline.
Provide a controlled test inbox and Google identity for live tests.

## Trust and data boundaries

- Fresh `auth.getUser()` verifies the customer before bootstrap and every account
  snapshot. Unconfirmed/anonymous/deleted identities cannot bootstrap through
  customer flows. Browser FormData and user metadata never supply trusted IDs.
- The narrow `bootstrap_customer_workspace(uuid)` routine is SECURITY INVOKER,
  has a fixed empty search path, and is executable only by service_role. It
  serializes a customer's bootstrap with a transaction advisory lock. Unique
  ownership/membership constraints and conflict checks prevent duplicate or
  team-shaped workspaces; upserts preserve names and existing memberships.
  The profile FK acquires the live Auth-user reference lock during insertion,
  preventing recreation after deletion without broadening Auth table grants.
- Profiles, companies and memberships have RLS. Authenticated users read their
  own records; only profile display/dismissal columns and company name are
  writable. Ownership IDs, roles and memberships are immutable to ordinary
  clients. There are no anonymous grants or public insert/delete shortcuts.
- This sole-owner schema cascades private records when Auth deletes a user, and
  never catalog rows. No deletion endpoint is added in #49. #50 must verify
  owner/no-other-members plus recent authentication before deletion; invitations
  must replace the sole-owner cascade policy before launch.
- Existing `/auth/callback`, admin login/actions/allowlist policies stay intact.
  Customer OAuth uses `/auth/customer/callback` and never claims an admin. The
  shared proxy refreshes cookies while preserving admin redirects; public
  missing/expired sessions and Auth errors do not redirect tender browsing.
- Recovery requires a successful approved recovery token verification, fresh
  user verification, and an HttpOnly HMAC proof bound to user ID, verified
  session ID, trusted safe destination and a fixed 15-minute expiry. Query flags,
  ordinary signup sessions and another user's/session's proof cannot authorize
  password updates. The proof remains bounded for success feedback/action
  rerenders and expires without extension; local sign-out clears it.
- `createPublicClient` remains stateless for tender data. The separate browser
  SSR client shares Auth cookies. `/api/account/session` returns only status,
  minimal identity, profile display name and workspace ID/name; private/no-store
  with `Vary: Cookie`, never tokens, metadata or privileged configuration.
- The root AccountProvider runs independently of server-rendered results, shares
  one reader/subscription, coalesces reads, discards late old-user results,
  refreshes on auth events/focus/account mutations/cross-tab broadcasts, and
  cleans subscriptions/requests on unmount. Consumers use `useAccount()` and
  call `refreshAccount()` after successful future mutations. No auth lookup per
  tender card or independent token-refresh timer. Header loading uses a neutral
  Skeleton; final menu/prompt composition remains #51.
- Bootstrap failure keeps the valid user session, reports unavailable state and
  offers retry/Continue browsing; account failure does not remove tender content.

## Verification evidence and limits

Local browser evidence uses Chromium and a **local fake HTTP Supabase adapter**,
with dummy bindings. It verifies the real Next.js forms, Server Actions, routes,
SSR cookie handling and rendered feedback, not live Supabase Auth or delivery.
No real emails, user passwords or provider credentials were used in screenshots.

| Check | Outcome |
| --- | --- |
| `npm ci` using locked dependencies/Node 24 | Passed |
| `npm test` (existing + focused auth/SQL/session/proxy tests) | Passed: 126 tests, 0 failures/skips |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed standalone and via build |
| `npm run build` with existing fonts/checks | Passed |
| Signup/login: 1440×900, 1024×600, 390×844, 320px | Local screenshots inspected; one header, signup cover responsive, login Card preserved, no horizontal overflow |
| Password visibility, autocomplete, pending/disabled, inline errors, safe cross-links | Local fake-adapter browser checks passed |
| Signup no-session confirmation, resend cooldown, Continue browsing with query/fragment | Local fake-adapter browser checks passed |
| Recovery token-hash → clean page → password Server Action → original destination | Local fake-adapter browser checks passed |
| Google PKCE callback round trip; ordinary customer denied admin | Local fake-adapter browser checks passed; live Google/admin login NOT VERIFIED |
| SQL RLS/grants/bootstrap retries/cascades and ownership conflicts | Real migration applied in PGlite; non-owner role tests passed |
| Stale user clearing, coalesced reads, ignored late responses | Focused race tests passed |
| Keyboard form order, long 320px error, password login, private snapshot, local sign-out | Local fake-adapter browser checks passed |
| Actual non-production migration/advisors/concurrent PostgreSQL connections | NOT VERIFIED; no confirmed isolated project/privileged binding |
| SMTP delivery, cross-device real emails, real resend/expiry/scanners | NOT VERIFIED; requires non-production templates/SMTP and controlled inbox |
| Live Google new/existing/cancel/error/same-email linking | NOT VERIFIED; configured provider disabled and test identity unavailable |
| Full incognito catalog/document/calendar/bookmark regression against hosted data | NOT VERIFIED end-to-end; existing unit tests retained/passed |
| Latest Vercel Preview and tested head SHA | Reported in PR; local evidence does not establish Preview verification |

PGlite's concurrent scheduled bootstrap calls share one embedded connection;
actual multi-connection PostgreSQL races and hosted Auth/RLS/advisors must be
verified in the isolated project. Fake adapters and compilation do not establish
production readiness.

For latest Preview, repeat both pages at all four viewports and test keyboard,
long errors, pending states, cross-links, local sign-out/cross-tab expiry and all
real provider cases above. Record exact deployment URL, PR head SHA, viewport and
case outcome in the PR. Later pushes invalidate affected Preview evidence.

## Release order

Complete non-production configuration/migration/provider verification first.
The owner separately authorizes production migration/configuration and merge.
Apply the additive private schema before enabling the customer UI in production.
No production configuration, migration, merge, backfill or real account deletion
is performed by this PR. Roll back the app if needed while retaining additive
private tables; do not drop customer data as a rollback shortcut.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs),
[password auth](https://supabase.com/docs/guides/auth/passwords),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking),
[Resend SMTP](https://resend.com/docs/send-with-supabase-smtp),
[shadcn CLI](https://ui.shadcn.com/docs/cli).
