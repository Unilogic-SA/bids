# Shared workspaces

The existing company is the workspace. Each verified customer keeps one owned
workspace and can join others without moving or merging bids. Owners manage
members and invitations; members can edit workspace bids and leave. The Account
& workspace menu opens one desktop Dialog/mobile Drawer for profile and team
management. Account deletion, ownership transfer, additional roles and notes are
outside this MVP.

## Access and selection

A workspace preference is an HttpOnly SameSite=Lax cookie, resolved against fresh
memberships. Every bid read/mutation/import explicitly includes the company ID
from its initiating snapshot. Normal bid operations remain user-client,
SECURITY INVOKER operations under live verified-membership RLS. Legacy RPC
signatures access only the caller's owned workspace. Profiles remain private.

Roster/invitation/member lifecycle RPCs are service-only and verify their actor
against live database ownership/membership. Actor IDs come from a fresh server
Auth getUser, never request metadata. Invitation acceptance checks the current
confirmed non-anonymous Auth email, then locks the company before the invitation
and adds membership atomically. Accepted links cannot rejoin after removal.
Removing a membership leaves all shared and personal bids intact. The company
owner FK restricts Auth deletion; deferred constraints retain the owner member.

## Sending configuration

Set these independently for each environment:

- `CUSTOMER_AUTH_SITE_URL`: canonical HTTPS origin (localhost HTTP allowed locally).
- `RESEND_API_KEY`: dedicated sending-only key restricted to the verified domain.
- `WORKSPACE_INVITE_FROM`: verified sender, e.g. `OpenBids <no-reply@openbid.co.za>`.
- `WORKSPACE_INVITATIONS_ENABLED=true`: enables the sending entry point only when
  all required configuration is present.

No configured sending key means an explicit unavailable invitation state. Account
and membership management still work. Existing Supabase Auth confirmation/Google
sign-in and SMTP are unchanged. Never copy production secrets into Preview.

Tokens contain 32 random bytes. Only SHA-256 hashes are stored. Links use
`/join/<id>#token=<token>`; the standalone nonce-protected HTML handoff removes the
fragment and issues a short-lived HttpOnly pending cookie. The normal review and
auth pages receive only clean `/invitations/<id>` URLs. The cookie lasts 30 minutes;
the invitation lasts seven days. Reopen the original email on another device or
when the handoff cookie expires. GET and the handoff POST never accept membership.

The database currently permits five members including the owner, counting pending
unexpired invitations as reserved seats; 60 seconds between sends to one invite;
20 logical sends per workspace per fixed hour. Expired pending invitation history
is paginated. Explicit resend rotates the token and increments the send generation,
invalidating older links. Request-bound retries use the identical body and Resend
idempotency key for that generation. No background queue/webhook is implied.

“Sent” means Resend accepted the email, not inbox delivery. A timeout/crash or
provider success followed by a database status failure can leave an unconfirmed
send. After the cooldown, manual resend creates a new generation. Resend's
idempotency window is 24 hours; this is not an exactly-once delivery guarantee.
Never log invitation request bodies, tokens, cookies or provider credentials.

## Collaboration and recovery

The visible workspace refreshes on focus, visibility return and every 30 seconds
while online. One provider coordinates refreshes; unchanged scopes keep selected
bids, scrolling and checklist drafts. Version conflicts retain the local draft and
require review before retrying. Workspace changes flush checklists and drain
in-flight batches; failure keeps the current workspace open. Generation checks
ignore late responses after identity/scope changes. Removal denies subsequent
reads/writes using live membership RLS and refreshes the account fallback.

Deploy the additive migration before the membership-aware application. After
sharing exists, do not roll back to the old sole-owner app: disable new invitation
sending instead. Keep schema and existing data. Do not run a blanket CLI push
against historical migration drift without reconciliation.

## Verification boundaries

The automated suite uses synthetic PGlite Auth/catalog fixtures and fake provider
responses. It exercises RLS/grants, scoped and legacy RPCs, bootstrap, owner
invariants, capacity, invitation states, replay, provider retry semantics, clean
handoff and client draft/auth races. It does not simulate PostgreSQL multi-connection
locking or prove actual Auth/Google/SMTP/inbox behavior. Those require isolated
service configuration and controlled recipients before claiming end-to-end delivery.

## Release evidence — 15 October 2026

The additive production migration was applied as
`20261015124223_shared_workspaces`. Its reviewed SQL SHA-256 is
`e32fb17db6bf5bcb903a8208e7c044191a1d399e04351dc2c64df32c294c09df`.
Pre/post checks retained three companies, three memberships and ten bids, with
identical bid ID/company/version digest and zero invitation rows created.

The database advisor's informational finding that `workspace_invitations` has
RLS enabled without policies is intentional: ordinary roles have no table grants
and no invitation policies, so they have no direct access. Service-only lifecycle
RPCs form the trusted server boundary. The existing leaked-password-protection
warning is unchanged.

Production sender and feature flag were configured separately by the release
operator. At this checkpoint a dedicated `RESEND_API_KEY` remained unavailable;
invitation sending correctly stays unavailable until that credential is configured.
Real inbox, existing/new-user and Google join verification remains outstanding.

Local implementation checks completed on Node 24.19.0: locked `npm ci`, 204 tests,
ESLint, Next type generation/TypeScript, webpack production build, and
`git diff --check` all passed. One Impeccable source scan of the new modal, forms,
selector and invitation review surface returned no findings. Browser/provider
verification is a separate release-operator checkpoint, not implied by those checks.
