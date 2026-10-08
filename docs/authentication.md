# Customer authentication foundation (#49)

This implements steps 1–3 of [master #48](https://github.com/Unilogic-SA/bids/issues/48).
Browsing, tender filters/details/documents/calendar actions and existing device
bookmarks remain public. Profile/company completion is optional. Settings,
email/password management outside recovery, global sign-out, account deletion,
and account menu/prompt composition belong to #50/#51. The customer foundation
provides a local sign-out control on `/sign-in`. Following the owner's live
authentication wiring request, the public header also exposes sign-in, signup,
verified identity, workspace retry and local sign-out through the existing
shared provider. Settings and completion prompts remain #50/#51.

## Hosted activation: 8 October 2026

The GitHub, Supabase, Vercel and Resend connectors were available for this inspection.
Supabase dashboard sign-in succeeded through its secure GitHub sign-in flow.
The owner subsequently authorized the production migration, Auth configuration
and Vercel dashboard fallback. The state below supersedes the initial inspection;
earlier local implementation evidence is unchanged. The PR remains unmerged.

| Boundary | Observed state | Required activation |
| --- | --- | --- |
| Exact Preview `bids-ksy7nms8p-unilogics-projects.vercel.app`, head `915c3e201b8a871728cc42260c67fb24271942a5` | Signed-out menu/navigation and exact query/fragment return passed; sign-in controls remain disabled | Isolated Preview configuration or separately authorized production release and provider tests |
| Supabase project `eanhpdxlskwxplglprrt` | Dashboard identifies this as `main / Production`; no isolated active auth test project was identified | Production preparation was owner-authorized; ordinary Preview remains unactivated |
| Customer schema | Migration applied; all three tables have RLS; column grants and service-role-only bootstrap verified | Live transaction tests passed for owner access, cross-user denial, ownership denial and bootstrap retries; test records rolled back |
| Auth URLs | Site URL is `https://www.openbid.co.za`; three scoped production callback entries saved | Confirm actual provider redirects after deployment; no arbitrary-host patterns |
| Providers | Email signup/confirmation enabled; owner saved Google client credentials and enabled Google, verified after fresh navigation | Actual Google success/cancellation/linking remain unverified; nonce checks and required email preserved |
| Email delivery | Resend confirms `openbid.co.za` is verified for sending in eu-west-1; DKIM/SPF/MX verified; open/click tracking disabled. Owner saved custom SMTP, verified enabled after reload | Real delivery and confirmation/recovery tests need a controlled inbox and deployed auth code |
| Signup/recovery templates | Saved `.RedirectTo` plus `&amp;token_hash={{ .TokenHash }}`; signup source verified after reload | Delivery and cross-device confirmation/recovery remain unverified; admin magic-link template untouched |
| Vercel environment management | Connector returned HTTP 403 for listing/creating production variables; authorized dashboard access worked | Production `CUSTOMER_AUTH_SITE_URL=https://www.openbid.co.za` saved. Owner redeployed main; auth PR deployment still required |
| Existing Vercel bindings | Public Supabase URL verified against this project; public key and separate Production/Preview `SUPABASE_SECRET_KEY` entries exist | Existing server fallback is supported; privileged values were not revealed, copied or independently authenticated |
| Recovery signing key | Owner saved `CUSTOMER_AUTH_RECOVERY_SECRET` as a Production-only Secret; presence/scope verified without revealing its value | Length and runtime signing remain unverified until auth code is deployed |

Supabase SMTP now uses sender `OpenBids <no-reply@openbid.co.za>`, host
`smtp.resend.com`, port 465 and a 60-second per-user interval. The owner created
`OpenBids Supabase Auth` with Sending access scoped to the verified domain and
entered/saved the SMTP credentials directly in Supabase. The dashboard confirms
a hidden stored password after reload. No API key is needed in the application
for this SMTP integration, and no secret was retrieved or exposed.

The owner redeployed Production main (`00e23473`) as
`dpl_7PobBnYmKa9nkovEGrWKUYTtwCPA`, READY at `www.openbid.co.za`.
Public Discover loaded successfully. This deployment does not include the
unmerged authentication PR. The latest Preview for `6d5e61c` is READY, but its
ordinary Preview auth configuration remains unactivated.

The owner created a Google Web application OAuth client and saved its credentials
directly in Supabase, then enabled Google. Fresh dashboard navigation confirmed
Google enabled, a populated client ID and a hidden stored secret. Skip nonce
checks and allow-users-without-email remain off. The instructed client origin was
`https://www.openbid.co.za` and redirect URI
`https://eanhpdxlskwxplglprrt.supabase.co/auth/v1/callback`; only basic identity
scopes are needed. Google Cloud's client console was unavailable in the cloud
browser, so its redirect/consent/audience settings have not been independently
verified. Actual OAuth sign-in remains unverified until the auth code is deployed.

Saved redirect allowlist:

```text
https://www.openbid.co.za/auth/confirm\?**
https://www.openbid.co.za/auth/customer/callback\?**
https://www.openbid.co.za/auth/callback
```

The escaped question mark matches the literal query separator; the suffix allows
the application's encoded `type`/`next` parameters only after the fixed callback
path. The last entry preserves the existing admin callback.

The migration connector recorded version `20261008153243`. The pending repo
migration was renamed to that recorded version without changing its SQL, and the
database test's file reference was updated. This prevents later CLI deployment
from trying to reapply the same schema under the previous pending timestamp.
Supabase security advisors reported no customer-schema finding; the existing
disabled leaked-password protection warning remains (paid-plan feature).

The header menu captures the current safe path, query and fragment when opened.
Auth links preserve that destination. Loading has a neutral skeleton and disabled
menu item; an account-read failure offers retry rather than claiming signed-out
identity. A verified identity with an unavailable workspace still has local
sign-out and a setup retry link. Sign-out errors stay visible, repeat clicks are
disabled while pending, and successful sign-out refreshes the shared reader and
other tabs. No placeholder settings link targets an unimplemented route.

### Concrete activation order

1. Select the authorized environment. Do not put the existing production
   service-role credential into Preview. A fully functional Preview requires
   its own isolated Supabase project and corresponding server credential.
2. Apply `20261008153243_customer_accounts.sql` to that environment; inspect
   table RLS, column grants and service-role-only bootstrap execution. Run
   Supabase security advisors and ownership/duplicate-bootstrap checks there.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   server-only `SUPABASE_SERVICE_ROLE_KEY`, exact `CUSTOMER_AUTH_SITE_URL`, and
   a fresh server-only `CUSTOMER_AUTH_RECOVERY_SECRET` (at least 32 bytes)
   in the matching Vercel environment. Do not infer missing variable values
   from the connector permission error.
4. Set the Auth Site URL to that exact origin. Add explicit `/auth/confirm`
   and `/auth/customer/callback` redirect patterns including the query strings
   generated by the app. Preserve existing admin destinations.
5. Configure custom SMTP and the signup/recovery token-hash email templates
   below. Preserve any non-customer email flows when updating shared templates.
   Use a dedicated Google OAuth client with the corresponding Supabase
   `/auth/v1/callback` redirect; keep existing security controls intact.
6. Redeploy and test a controlled inbox: signup, confirmation on another
   device, login, recovery completion, resend, expired links, local sign-out,
   cross-tab identity clearing, Google success/cancellation/linking, customer
   admin denial, and public browsing. Record the tested deployment and SHA.

The authorized hosted writes were the additive migration, production Site URL,
callback allowlist, signup/recovery templates, and Vercel production trusted
origin. The owner completed the recovery signing key, Resend sending key and
Supabase SMTP credentials, and redeployed the existing production main.
The owner also completed Google credentials/provider enablement. No real customer
signup, auth release or merge was performed. The database role checks used synthetic
identities inside one rolled-back transaction, with zero users/profiles remaining.
This tests deployed PostgreSQL permissions and repeated bootstrap, not real Auth
signup or multi-connection races.

Preview `70c628b` exposed a duplicated fragment through Next client navigation.
The auth return controls now use document navigation. On `915c3e2`, return to
`/?q=software#tender-result-2` passed with one fragment and the expected tender
focused. Signed-in menu actions and real provider flows remain unverified.
Local production build, lint, typecheck and all 126 tests passed after header
wiring; GitHub CI for `915c3e2` also completed successfully.

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
Google. Following the owner's signup revision, signup is standalone: neither the
app top bar nor its navigation sub-bar renders. The block's brand row links to
OpenBids and its wrapper uses the full viewport height. The desktop cover uses
the requested Unsplash office placeholder, downloaded into
`public/auth-signup-cover.jpg` from
[this image](https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80).
It is served locally without third-party browser image requests and remains
hidden below `lg`. Login retains the centred `max-w-sm` Card,
CardHeader/CardContent, email/password fields, recovery link and social action.
Following the same owner revision, login is also standalone with no app top bar
or navigation sub-bar and uses the full viewport height. Both use one shared provider, add
accessible password visibility/autocomplete, inline feedback, pending controls
and safe cross-links. Recovery and confirmation use installed shadcn primitives.

## Environment inspection and prerequisites

Before implementation, the existing configured Supabase endpoint responded to a
read-only public `/auth/v1/settings` request. Email signup was enabled, email
confirmation was enabled (`mailer_autoconfirm=false`), and Google was disabled.
Public URL/key variables were present. Service-role and trusted customer-origin
configuration were absent in that earlier implementation environment. Available
cloud metadata did not establish an isolated development/Preview project. That
earlier phase made no hosted writes; the subsequent authorized activation and
verified existing Vercel bindings are recorded at the top of this document.

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
- Apply only `supabase/migrations/20261008153243_customer_accounts.sql` and its
  required baseline dependencies to the isolated project using the normal CLI.
  Inspect actual grants/RLS and Supabase database advisors there. CLI 2.120.0
  generated the original pending filename with `supabase migration new customer_accounts`;
  `SUPABASE_HOME` was directed to ignored `.tools/supabase` because the default
  home directory was read-only. The file now matches the applied connector version.
- Keep email confirmation enabled. For the isolated initial policy, set minimum
  password length to 8. The existing production provider requires letters and
  digits; this activation did not weaken it. Its numeric length was redacted by
  the browser, so the production minimum remains unverified. Passwords
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
this Vercel project only; never accept arbitrary hosts. The owner-authorized
production origin/allowlist is recorded above. `CUSTOMER_AUTH_SITE_URL` must match the deployed
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
| Signup/login: 1440×900, 1024×600, 390×844, 320px | Local screenshots inspected; both pages have no app header/sub-bar, cover responsive, login Card preserved, no horizontal overflow |
| Password visibility, autocomplete, pending/disabled, inline errors, safe cross-links | Local fake-adapter browser checks passed |
| Signup no-session confirmation, resend cooldown, Continue browsing with query/fragment | Local fake-adapter browser checks passed |
| Recovery token-hash → clean page → password Server Action → original destination | Local fake-adapter browser checks passed |
| Google PKCE callback round trip; ordinary customer denied admin | Local fake-adapter browser checks passed; live Google/admin login NOT VERIFIED |
| SQL RLS/grants/bootstrap retries/cascades and ownership conflicts | PGlite tests passed; deployed PostgreSQL owner/cross-user/anonymous/ownership/retry checks passed in a rolled-back transaction |
| Stale user clearing, coalesced reads, ignored late responses | Focused race tests passed |
| Keyboard form order, long 320px error, password login, private snapshot, local sign-out | Local fake-adapter browser checks passed |
| Actual non-production migration/advisors/concurrent PostgreSQL connections | NOT VERIFIED; no confirmed isolated project/privileged binding |
| SMTP delivery, cross-device real emails, real resend/expiry/scanners | NOT VERIFIED; production SMTP configuration is saved, but provider lifecycle needs deployed auth code and a controlled inbox |
| Live Google new/existing/cancel/error/same-email linking | NOT VERIFIED; Google provider enabled with owner-saved credentials; needs deployed auth code and a controlled identity |
| Full incognito catalog/document/calendar/bookmark regression against hosted data | NOT VERIFIED end-to-end; existing unit tests retained/passed |
| Latest Vercel Preview and tested head SHA | Reported in PR; local evidence does not establish Preview verification |

PGlite's concurrent scheduled bootstrap calls share one embedded connection;
actual multi-connection PostgreSQL races and hosted Auth lifecycle must still be
verified in the isolated project. Live production RLS/advisors were checked as
recorded above. Fake adapters and compilation do not establish
production readiness.

For latest Preview, repeat both pages at all four viewports and test keyboard,
long errors, pending states, cross-links, local sign-out/cross-tab expiry and all
real provider cases above. Record exact deployment URL, PR head SHA, viewport and
case outcome in the PR. Later pushes invalidate affected Preview evidence.

## Release order

Complete non-production provider verification before release. The owner authorized
production migration/configuration on 8 October; those completed writes are
recorded above. Merge/release remains outstanding. The additive private schema
is already applied before enabling the customer UI in production. No production
auth deployment, merge, backfill or real account deletion was performed. The
owner's redeployment of existing main is recorded above. Roll back
the app if needed while retaining additive
private tables; do not drop customer data as a rollback shortcut.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs),
[password auth](https://supabase.com/docs/guides/auth/passwords),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking),
[Resend SMTP](https://resend.com/docs/send-with-supabase-smtp),
[shadcn CLI](https://ui.shadcn.com/docs/cli).
