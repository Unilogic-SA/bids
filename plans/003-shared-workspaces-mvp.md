# OpenBids: shared workspaces and invitations MVP

Design and implementation handoff • 15 October 2026 • Status: IMPLEMENTED; RELEASE VERIFICATION IN PROGRESS

Execution record: the owner explicitly approved full implementation and release after this design. Implementation starts from main `ee8af5b` and preserves its mobile-menu refinement. Production migration `20261015124223_shared_workspaces.sql` was applied with unchanged existing workspace/bid records. Live owner/member, invitation acceptance/replay/removal, bootstrap, scoped/legacy RPC and owner-deletion checks passed in a transaction that was rolled back. Dedicated production Resend sending-key configuration and real email delivery remain outstanding. The original proposal and implementation boundaries below are retained as the design record; this execution note supersedes its original no-implementation status.

Planned against `Unilogic-SA/bids`, main commit `faf9804d4c75ab94c2f02dbd42adba4ebd790ac1`.
Effort: L overall, in three ordered implementation slices. Risk: HIGH at the authorisation boundary; ordinary UI scope is small.

## Recommendation

Extend the existing company workspace. Keep `companies`, `company_memberships`, `profiles` and `workspace_bids`; present a company as a “workspace” in the interface. Add invitation records, an owner/member role model and explicit workspace selection. Keep Supabase Auth for identity, PostgreSQL for access and invitation state, Next.js Server Actions for UI mutations, and Resend for invitation email.

An existing user's workspace and bids remain intact when they join another workspace. Each user retains one automatically created personal workspace and can join shared workspaces. A small selector appears when there is more than one. Do not add workspace creation, organisations above workspaces, assignments, billing or a dedicated profile page.

The management surface is one shadcn Dialog on desktop and Drawer on mobile, with Account and Workspace views. Existing sign-in/sign-up pages stay as pages. This is a proposal for review; it authorises no implementation or hosted writes.

## Evidence and inspection limits

Inspected current main locally, relevant GitHub issues, live database metadata/policies/function definitions, Supabase migrations/advisors, Resend domain/templates/webhooks, and Vercel project/deployment metadata. Production SQL was SELECT-only. No customer content was exported, no emails sent, and no application/schema/configuration change made.

| Boundary | Confirmed now | Design consequence |
| --- | --- | --- |
| Next.js/React | Next 16.2.6, React 19.2.4, TypeScript, npm; Supabase SSR; shadcn radix-nova | Extend established providers, actions, validation and UI primitives |
| Supabase project `bids` | Active PostgreSQL 17; company/customer/workspace migrations applied | Reuse the deployed model; do not create a second tenancy system |
| Relevant live tables | RLS enabled; metadata reports 3 profiles, 3 companies, 3 memberships and 11 workspace bids | Existing private data must survive unchanged; metadata counts are approximate |
| Memberships | Unique `user_id`; role check only permits `owner`; read-self policy | Multiple memberships and `member` require an additive migration |
| Bid access | All four policies require company ownership, plus live verified-user check | Adding a membership alone grants no bid access today |
| Bootstrap | Live service-only invoker RPC rejects non-owner memberships and additional members | Must change before an invited member or their owner logs in again |
| Deletion | Live company owner FK uses ON DELETE CASCADE; bids cascade from company | Owner deletion could erase shared work; replace the FK before sharing |
| Resend | `openbid.co.za` verified, sending enabled, DKIM/SPF records verified; tracking off; no hosted templates or webhooks | Existing domain is usable. Build one minimal code-owned invitation template; no webhook dependency |
| Existing SMTP | `docs/authentication.md` records Supabase SMTP through Resend, configured 8 October | Historical evidence only: SMTP settings were not freshly inspected this session |
| Application email | No Resend sending dependency/integration in package.json or customer code | Workspace invitations require a new server-side sending path and scoped key |
| Vercel `bids` | Next.js project, Node 24.x, latest listed production deployment READY; `www.openbid.co.za` and apex configured | Use current hosting; email links derive from trusted configured origin |
| Vercel env metadata | Connector returned HTTP 403; local Vercel CLI unavailable | Actual current env presence/scoping is unverified; do not infer credentials exist |
| Advisors | Only returned warning: leaked-password protection disabled | No reported schema finding, but this does not validate the proposed sharing design |

No live Auth/Google/SMTP lifecycle, email delivery, UI runtime or load test was performed. Source main is not proof that a specific deployment runs that SHA. Earlier `plans/README.md` and auth documentation contain historical review statuses; live schema and current code take priority for current technical facts. Earlier migration versions differ between repository and hosted history for some catalog migrations; reconcile history before any future full CLI push rather than blindly replaying it.

## Current code that must change

| Location | Current assumption / reusable behaviour |
| --- | --- |
| `src/lib/auth/session.ts:20–29` | `.maybeSingle()` membership and `role !== "owner"` rejection; returns one workspace |
| `src/lib/workspace/query.ts:13–36` | `workspaceClient()` filters company owner to current user and rejects members |
| `supabase/migrations/20261008153243_customer_accounts.sql` | Single membership, owner-only role, service-only bootstrap and cascading ownership |
| `supabase/migrations/20261012112923_bid_workspace.sql:67–85` | Bid RLS explicitly owner-only |
| Same migration, save/import RPCs | Derive one owned company implicitly |
| Same migration, list RPC at line 213 | No company predicate: currently relies on RLS exposing only one company; broadening RLS alone would mix all accessible companies |
| Same migration, update/delete RPCs | Versioned but no explicit company argument; must become selected-workspace-aware |
| `src/components/account/account-menu.tsx` | Existing account DropdownMenu, verified identity, retry and local sign-out; add settings and selector here |
| `src/components/account/account-provider.tsx` | Shared account snapshot, focus/auth/navigation refresh, cross-tab broadcasts; retain this single reader |
| `src/components/workspace/workspace-provider.tsx:56–68` | State already keyed by `user.id:workspace.id`; retain and extend generation guards |
| Same provider, BroadcastChannel | Same browser context only; does not notify a partner's browser/device |
| `src/lib/workspace/checklist-autosave.ts` | Version conflict and draft preservation already implemented; use them for team editing |
| `src/lib/auth/redirects.ts:15` | Safe-return allowlist does not permit invitation destinations |
| `src/app/layout.tsx` | Umami script is global; bearer invitation links must never enter this layout |
| `src/components/workspace/guest-import-prompt.tsx` | Device import already explicit; name the destination and explain sharing |
| Issues #50 and #51 | Earlier settings-page/security/prompt plans remain open. This owner's current modal scope replaces the dedicated settings-page direction for this proposal; do not implement their entire old scope |

Representative current excerpts for drift checks:

```ts
// src/lib/auth/session.ts
supabase.from("company_memberships")
  .select("company_id,role,companies!inner(id,name)")
  .eq("user_id", user.id).maybeSingle()
// membership.data.role !== "owner" currently makes account unavailable.

// src/components/workspace/workspace-provider.tsx
const identity = account.status === "signed-in"
  ? `${account.user.id}:${account.workspace.id}` : null
```

Repository conventions: Zod validation; thin `"use server"` actions delegating to library functions; session-aware Supabase client for normal user data; sanitized result unions and inline failures; `ACCOUNT_CACHE_HEADERS` for private responses. Preserve public catalog browsing, admin authentication and existing bid preparation behaviour. `PRODUCT.md` explicitly excludes note-taking: schema legacy notes are data to preserve, not a feature to restore.

## MVP behaviour and permissions

Inviting someone shares the entire selected workspace: existing and future saved bids, checklists, stages, submission records, outcomes and archives. It does not share their other workspaces or import device saves automatically. Explain this before inviting and joining.

| Action | Owner | Member |
| --- | --- | --- |
| Read all bids, archived records and preparation in that workspace | Yes | Yes |
| Save/import tenders, update checklist/stage/submission/outcome, archive/reopen | Yes | Yes |
| Remove a bid using existing confirmation/version safeguards | Yes | Yes |
| See workspace name and a minimal member roster | Yes | Yes |
| Rename workspace | Yes | No |
| Invite, resend, cancel invites; remove another member | Yes | No |
| Leave workspace | No | Yes |
| Edit own display name; read own email; local sign-out | Yes | Yes |
| Transfer ownership, delete workspace/account, edit roles | Deferred | Deferred |

One owner per company remains mandatory; no admin/viewer roles. Keep one owned personal workspace per user via the existing unique `companies.owner_user_id`. Joining never changes that owner or moves bids. Suggested initial shared-workspace capacity is 5 total users including owner, with unexpired pending invites reserving seats. This is a proposed operational MVP limit, not an existing pricing promise. Keep limits in one server/database policy location and test them.

## Management modal and workspace selection

From the profile menu, “Account & workspace” opens the common container. A secondary entry may open its Workspace view directly; do not build separate member/settings modals.

Account view: optional display name, read-only signed-in email, Save changes and existing sign-out-on-this-device. Reuse existing password recovery link where helpful. Defer email change, add/change password, provider linking, global session controls, avatar uploads and account deletion. Do not present disabled placeholders for these.

Workspace view: selected workspace name, clear owner/member role, member roster and (owner only) compact email invitation form plus pending invitations with resend/cancel. Member sees Leave workspace; owner can remove members with deliberate confirmation. Roster rows expose display name/fallback and role to members; owner receives roster email addresses for management. No general lookup of registered users. A server-only roster operation returns only selected-company members and the necessary projection; profiles remain read-self under RLS.

Use existing Dialog/Drawer/Tabs/Avatar/Input/Button/DropdownMenu/ScrollArea/Skeleton and Sonner. Compose confirmations from installed shadcn primitives; do not build custom overlay mechanics. Close the dropdown before opening a modal; restore focus to its stable trigger when closed. Keep forms and errors inline, long names/emails wrapped, pending actions disabled, keyboard/Escape behaviour, and bounded scrolling with a visible mobile action. Do not open stacked drawers or auto-focus the invite keyboard on mobile. Preserve existing tokens, fonts and Tabler icons.

If only one workspace is accessible, hide the selector. If several, put a small selected-workspace menu in the account area and display the active workspace name beside the workspace page heading. Bookmark affordances should name the destination accessibly, e.g. “Save to Unilogic”. Saving always targets the selected workspace; no new choose-a-workspace dialog for every bookmark.

Active selection is a non-authoritative UUID preference in a server-set HttpOnly, SameSite=Lax cookie (Secure in production), not a role/JWT claim. Resolve only among current memberships. Cookie absent/invalid/removed: fall back deterministically to the owned workspace, otherwise earliest membership; never silently write to that fallback on behalf of a stale request. Keep the selection per browser; cross-device persistence is deferred. On sign-out, clear the preference so another account does not inherit it.

All requests capture an explicit `companyId` from the rendered account snapshot. A switch action verifies membership, flushes current checklist edits using existing autosave safeguards, waits for in-flight mutations, updates selection, then refreshes the account. Clear selected bid, bulk selections, pagination/board offsets and old search context on switch; preserve view preference per `user:workspace`. If flush fails, keep the editor and workspace open. Existing cross-tab reader then refreshes tabs that share the preference cookie. Generation guards discard late responses, but are not a substitute for explicit database scope.

An already-running request remains bound to the workspace in which it was initiated; it cannot be redirected by a later cookie change. Removal/leave must return access-lost without silently retrying in the fallback workspace. Already delivered data cannot be recalled from someone's device; new reads/writes are denied after revocation is committed, subject to normal in-flight transaction timing.

## Database design

### Keep and extend current tables

`companies`: retain unique owner and existing name. Replace `owner_user_id` Auth FK with ON DELETE RESTRICT before shared access is enabled. Account deletion remains unavailable in this MVP. This deliberately prevents an admin/Auth deletion from silently cascading a shared company's bids. A future deletion workflow must explicitly transfer or close owned workspaces; do not add ownership transfer now. Add `invite_send_window_started_at` and `invite_send_count` for a fixed hourly sending budget, writable only through the service boundary and excluded from customer read models. Reset/increment them atomically under the company row lock; `last_send_attempt_at` alone cannot enforce a workspace-wide hourly budget.

`company_memberships`: retain PK `(company_id,user_id)`; remove the single-column UNIQUE(user_id); allow `owner` and `member`, default `member`; index `user_id` for account membership reads. Add partial unique index on company_id WHERE role='owner'. Enforce owner membership matches `companies.owner_user_id` and cannot be removed/demoted, through narrow membership lifecycle functions plus a database constraint trigger for cross-table invariants. Migration validates existing rows first. Ordinary authenticated roles still cannot insert/update/delete memberships directly.

`profiles`: keep self-only SELECT/UPDATE and existing grants. Do not broaden profile access to let all collaborators see unrelated profile/dismissal data. No active-workspace column required.

`workspace_bids`: retain company ID, tender uniqueness, version column, snapshot and existing triggers. Existing bids require no backfill, duplication, merge or owner rewrite.

### Add `public.workspace_invitations`

| Column | Purpose |
| --- | --- |
| id UUID PK | Stable invitation identifier |
| company_id UUID FK companies | Target workspace; ON DELETE CASCADE |
| email_normalized text | Trim/lowercase only, validated and bounded; do not strip plus tags/dots |
| token_hash text | SHA-256 of a cryptographically random 32-byte bearer token; never return in roster/list |
| invited_by UUID nullable | Auth FK ON DELETE SET NULL; never cascades workspace data |
| created_at, updated_at timestamptz | Operational timestamps |
| expires_at timestamptz | Seven-day invitation validity; validated on every lookup/accept |
| accepted_at, revoked_at timestamptz nullable | Terminal state, mutually exclusive |
| accepted_by UUID nullable | Audit attribution, ON DELETE SET NULL |
| send_version integer | Incremented for each explicit resend/token rotation |
| last_send_attempt_at timestamptz | Atomic cooldown and rate-limit accounting |
| send_status text | `sending`, `sent`, `failed`, `unknown`; independent from accepted/revoked/expired |
| resend_email_id text nullable | Provider correlation only |
| send_error_code text nullable | Sanitized operational category, not raw provider response/payload |

Unique `(company_id,email_normalized)` WHERE accepted_at IS NULL AND revoked_at IS NULL. Do not put `now()` in the partial-index predicate: expired rows are renewed by rotating the same pending row, or explicitly revoked before replacement. Accepted/revoked history may remain. Unique token_hash and an index on `(company_id,created_at)` cover token validation and management reads. RLS enabled; revoke all access from anon/authenticated, grant only service_role as required. Every service-only RPC also revokes PUBLIC/anon/authenticated EXECUTE explicitly.

### RLS and privileged boundaries

Normal bids continue using the authenticated user's Supabase client, SECURITY INVOKER RPCs and live verification helper. Replace owner-only bid policies with verified membership predicates for that row's company_id. UPDATE needs SELECT plus USING/WITH CHECK; keep immutable identity and restricted writable columns. Keep `workspace_bid_entries` security_invoker=true.

Membership read-self remains unchanged. Company SELECT can continue checking the caller's own membership; company UPDATE stays owner-only. This avoids a self-referential membership policy and company↔membership recursion. Roster access goes through one tightly bounded server-only operation, not a recursive “see everybody's memberships” RLS policy.

Invitation lifecycle and roster use the existing privileged-server pattern: a fresh `auth.getUser()` + isVerifiedCustomer at every Server Action/read boundary, followed by service-only SECURITY INVOKER RPCs with actor ID/email taken solely from that verified user. Client-supplied actor, role or verification flags are never trusted. The RPC rechecks actor membership/ownership and company invariants inside its transaction. A narrowly scoped helper in unexposed `app_private`, with fixed empty search_path and restricted EXECUTE, checks the actor's current confirmed, non-anonymous Auth email for acceptance (and live existence for sensitive membership operations). Do not grant broad Auth table SELECT or use user_metadata/JWT role lists as authority.

Service-only RPCs are a trusted backend boundary, not RLS-protected user queries. Tests must prove ordinary clients cannot execute them. No public SECURITY DEFINER endpoints; no service-role bid reads/writes as a workaround for member RLS failures. All SQL fully qualifies objects and pins search_path. Validate schema exposure, grants, helper privileges and database advisors in staging.

### Explicit scope for every bid RPC

Add new overloads that require p_company_id to save/import/list/update/delete. Update/delete must filter BOTH company_id and bid id/version. In list, put company filtering in the first `filtered` CTE so totals, stage counts, ranking, pagination and board offsets are all scoped. Import passes company through to save; conflict fallback reads also filter it. Never `LIMIT 1` a membership to resolve ambiguity.

During rollout, retain old signatures for old browser tabs but leave them strictly scoped to the user's owned company. Particularly replace the old list body with a wrapper to the new company-scoped list using only the caller's owned company. Old update/delete wrappers likewise scope to the owned company. Legacy clients may see their personal workspace only; they must never see combined memberships. After later compatibility review, retire old signatures in a separate migration.

Bootstrap remains service-only, serialized and idempotent. Ensure profile, ensure exactly one owned personal company, ensure its owner membership using ON CONFLICT(company_id,user_id); preserve every joined membership. Remove the checks that reject non-owner memberships/additional members. Never select an arbitrary membership or use ON CONFLICT(user_id) once the unique constraint is removed. Test first login, repeated login, owner after inviting, member after accepting, and concurrent bootstrap.

## Invitation flow

### Create and send

1. Owner submits one email for the explicit selected company. Zod validates; session is verified freshly. Database locks company row, verifies actor owns it and has owner membership, checks duplicate existing member/current verified email, capacity and rate limits, then creates/renews one invitation atomically.
2. Generate a 32-byte random URL-safe token on the server; persist only its hash. Fixed member role; no client-selected role. Store send_version and attempt time. Suggested initial limits: 60 seconds between sends to the same invitation and 20 logical sends/workspace per fixed one-hour window. Enforce in PostgreSQL under the company lock; explicit resends consume budget and same-generation provider transport retries reuse the reserved send. These are adjustable MVP abuse limits. Read member/invitation lists in bounded pages; do not silently truncate account memberships or choose the first returned membership.
3. Send through Resend REST API from a `server-only` module using built-in fetch, a dedicated domain-scoped sending key, and trusted configured origin. No SDK dependency is necessary. Supply HTML and plain text; escape all names and never interpolate names into arbitrary headers/URLs. Use a stable idempotency key such as `workspace-invite/<id>/<send_version>` with exactly identical payload during bounded retries.
4. Await send completion in the request. Update delivery status/provider ID only if send_version still matches. “Sent” means Resend accepted the send, not inbox delivery. No webhook or background job is needed for this MVP.

Provider 429/5xx/transport failures receive a small bounded retry within the request, honoring Retry-After within the request budget; permanent 4xx errors do not loop. Definitive rejection marks failed. A timeout or process crash may leave sending/unknown: show “Send not confirmed; resend available” after cooldown. Do not claim exactly-once email delivery across provider/database transactions.

Explicit Resend rotates token/hash, increments send_version and resets expiry. This invalidates older invitation links. Persisting only a hash means a later process cannot reconstruct the old URL: never reuse the same idempotency key with a different token/body. A later manual resend is a new send generation. Provider retry deduplication is limited to its documented 24-hour window. A crash after send but before status commit is recoverable through explicit resend, without an email queue/outbox in v1.

Invite email identifies inviter/workspace, explains shared bid access, expires in seven days and offers “Review invitation”. It does not log in the recipient, set passwords, subscribe them to marketing, attach tender data or grant membership. Supabase continues sending confirmation/recovery through existing SMTP. No auth template/provider change is required just for workspace invitations.

### Review without leaking the token

Use an invitation URL `https://<trusted-origin>/join/<invitation-id>#token=<opaque-token>`. The fragment keeps the token out of normal HTTP URL/access logs. Disable tracking as already configured; validate fragment preservation in the actual email clients used for staging QA.

Implement `/join/[id]` as a minimal Route Handler HTML handoff, outside the React/root layout: no analytics, providers, third-party assets or external requests. Its small nonce-protected script reads and removes the fragment, then POSTs id+token to the same origin. Strict CSP, no-referrer, no-store, noindex; bounded body/token validation and Origin checks. POST validates invitation existence/hash/expiry without consuming it, sets a 30-minute HttpOnly Secure SameSite=Lax pending-invitation cookie, and returns the clean `/invitations/<id>` destination. Use a local non-__Host cookie name for HTTP development if necessary; production __Host cookies require Secure and Path=/.

Store only id+token in that short-lived HttpOnly cookie, not localStorage or a `next` query parameter. Treat it as a bearer credential; never log Cookie/body values. It has no authority without database token/state checks. One pending invitation per browser is sufficient for MVP: opening another replaces it. Handoff failure offers retry/reopen email. Missing/expired cookie offers reopen original email. A mailbox scanner may perform the handoff, but cannot accept or consume the invitation through GET or that POST.

The clean review page uses the normal shadcn shell and no secret-bearing URL. Before sign-in, expose only workspace/inviter display labels and masked target email after token validation. Never expose bid data, roster or a public list of pending invites. Add exactly `/invitations/<uuid>` to the safe-return allowlist; drop query/fragment for this route. Preserve existing protections against external redirects/encoded separators/admin destinations.

### Authenticate and accept

Signed-out recipient chooses existing email/password or Google sign-in, or creates an account through the current pages, with safe `next=/invitations/<id>`. Keep account confirmation enabled. Fresh successful authentication returns to review; it does not automatically join.

For email confirmation on another device, do not put the invitation secret in the Supabase confirmation redirect. The user reopens the original invitation there if the pending cookie is missing. Expired 30-minute browser handoff works the same way; the email invitation itself remains valid for seven days.

Wrong signed-in email: explain the mismatch and offer change account, retaining the short-lived pending invite through that deliberate sign-out. Ordinary sign-out outside the flow clears it. Do not create a second identity, merge accounts, accept an alias or attach membership based on unverified email. Compare normalized invitation email to current verified Auth email at acceptance, not editable profile metadata or a stale JWT email.

Accept is an explicit authenticated POST/Server Action. In one database transaction, acquire a consistent company lock then invitation row lock; recheck unrevoked/unexpired/hash, current verified email, owner invariant and seat limit; insert `(company_id,user_id,'member')` idempotently; mark accepted_at/by. Concurrent accept, resend, revoke and remove/leave use the same company-first locking order. A revoked or expired invite cannot add membership. Repeated acceptance by its accepted user is a success only while the membership still exists; an old accepted invite cannot restore access after removal. Existing membership returns “Already a member” without role changes. No provider lookup or email send inside the transaction.

After success, set selected workspace cookie to the joined company, clear pending invitation cookie, refresh account/workspace state, and navigate to its workspace. Personal workspace/bids are untouched. If post-commit response is lost, retry shows joined state. Invalid/expired/revoked states give safe restart instructions; a recipient cannot resend somebody else's invitation.

## Membership removal, leaving and shared editing

Owner removal and member leave each run an authorised transaction under the company lock. Never remove/demote the owner. Removal revokes outstanding pending invitations for that target verified email in this workspace, so an older unused invite cannot restore access. Leaves/removals delete only membership, never the user's Auth identity, personal workspace or shared bid records. Rejoining requires a new valid invite. Actor and target IDs/role/ownership are checked in the database, not only hidden buttons.

Keep existing optimistic version checks and conflict result shape. Update conflict language from “another tab” to “someone else updated this bid”. On conflict, preserve the draft and require reviewing the latest value; never silently overwrite or automatically merge the whole checklist. Existing batch stage edits remain per-record with partial-success feedback, bound to the initiating company.

For cross-device freshness, add one coordinated 30-second background refresh while `/workspace` is visible, plus focus/visibility return/manual refresh. Pause when hidden/offline; coalesce overlapping requests. Reuse provider revision/read paths, but add a background mode so polls do not show full-page skeletons or remount dirty editors. Preserve ChecklistAutosave.observe semantics, selected bid, selection and scroll when scope is unchanged. Refresh account membership periodically with workspace data; 403/access-lost clears company-specific UI and offers fallback without changing mutation targets. Roster refreshes when modal opens and after member actions.

BroadcastChannel stays as a fast same-browser signal; it does not provide collaboration between different users. Defer Supabase Realtime/presence/cursors and automatic collaborative text merging. Shared data is persistent immediately; other visible devices refresh within roughly 30 seconds under healthy connectivity. This is the MVP's explicit freshness contract.

## Implementation slices and verification gates

Do not execute this plan until selected for implementation. Use `codex/<issue-number>-shared-workspaces`, one originating issue and PR if that matches the selected scope. No issue was created by this design task. Before work, compare changed paths against planned SHA using `git diff faf9804..HEAD -- <paths>` and reconcile drift. Read AGENTS.md and relevant docs/ai guidance. Avoid broad cleanup/upgrades.

### 1. Membership, explicit scope and data safety

Create an additive migration with `supabase migration new shared_workspaces` (discover installed CLI help first; do not invent a timestamp). Change membership constraints/bootstrap/FK, add invitation storage/service operations and explicitly scoped bid RPCs plus safe legacy wrappers. Update account snapshot types/reader and workspace query/actions/routes/provider to pass company IDs. Keep invitations hidden until later slices are complete.

Touch: `supabase/migrations/<generated>_shared_workspaces.sql`; `src/lib/auth/{account-state,session,workspace}.ts`; `src/lib/workspace/{query,actions,types,validation}.ts`; both `src/app/api/workspace` routes; `src/components/workspace/{workspace-provider,workspace-client,guest-import-prompt}.tsx`; directly affected callers/tests.

Gate: isolated database fixture applies baseline plus additive migration; owner/member/outsider, two-workspace list counts and scoped mutation tests pass. `npm test`, lint/typecheck/build pass. Existing bids retain IDs, company IDs and contents. No new tables/client privileges allow unauthorised changes. Old RPCs return personal-workspace data only.

### 2. Invitation service and acceptance lifecycle

Create `src/lib/workspace/{invitations,invitation-actions,invitation-validation,membership-service}.ts`, `src/lib/email/workspace-invitation.ts`, `/join/[id]/route.ts`, `/invitations/[id]/page.tsx`, focused tests; update safe redirects and `.env.example` with names/placeholders only. Implement limits, versioned sends, clean handoff, auth continuation, atomic acceptance, revoke/remove/leave. Server-only email and privileged data modules must not be imported into browser bundles.

Gate: tests cover forged actor/role/company, token state/expiry/hash, wrong verified email, replay after removal, concurrency, provider timeout/failure, resend rotation and no-secret return payload. Real controlled staging inbox receives one operational template; existing and new users plus Google can join through existing auth. Check email link on another device, scanner GET, cooldown, and clean URLs/no analytics token leakage. A simulated post-send crash yields truthful unknown state and recoverable resend.

### 3. Compact modal, selector and freshness

Add `src/components/account/{account-workspace-dialog,account-profile-form,workspace-members,workspace-selector}.tsx` as compositions, plus settings actions/read model under `src/lib/auth` or membership service. Integrate via account menu/provider and existing public shell. Implement background refresh/draft-safe switching and destination-labelled imports/bookmarks. Keep scope small: no profile route, notes, assignment, extra roles or security settings project.

Use current PRODUCT.md/DESIGN.md, Impeccable shape/distill/polish guidance and existing shadcn primitives; planning does not require new visual assets. Gate: 1440×900, 1024×600, 390×844 and 320px browser checks; keyboard/focus restoration; long labels; mobile no keyboard pop-up on menu/modal open; switch with dirty checklist; failure keeps editor open; 30-second partner refresh preserves local draft; removal clears access; no stale workspace response flashes. Verify public search/bookmarks/admin still work.

Exact repository checks (commands confirmed from package.json/CI; not run during this design):

| Command | Expected |
| --- | --- |
| `npm ci` on Node 24 | Locked install succeeds in implementation environment |
| `npm test` | All existing and new node:test/PGlite tests pass |
| `npm run lint` | Exit 0 |
| `npm run typecheck` | Next type generation and tsc pass |
| `npm run build` | Next webpack production build passes |
| `git diff --check` | No whitespace errors |

Use `src/lib/auth/account-database.test.ts` and `src/lib/workspace/workspace-database.test.ts` as database fixture patterns; add `shared-workspace-database.test.ts`, `invitations.test.ts` and targeted account/client-state tests at depths discovered by the existing npm test glob. Update Auth fixtures to include verified email where required. PGlite is valuable for RLS/grants/invariants but not a replacement for PostgreSQL multi-connection race tests or real Auth/SMTP.

## Required acceptance tests

1. A owns workspace A; B owns B. Joining A grants B access to A while B's original bids remain private from A. Same tender may exist once in each with independent preparation.
2. All APIs/RPCs scope list items, stage counts, pagination, selected bid, bookmarks, save/import, batch updates and conflict fallback to requested company. User with memberships in A and B cannot accidentally update B through an A-scoped bid ID.
3. Owner/member/outsider/anon/unconfirmed/deleted tests cover SELECT/INSERT/UPDATE/DELETE, view/RPC access, direct membership manipulation and service-only EXECUTE denial.
4. Owner login after inviting and member login after accepting succeed; concurrent bootstrap creates one personal company and preserves shared memberships.
5. Accept/revoke/resend/capacity/remove race tests on multiple real PostgreSQL connections never add an unauthorised member or exceed capacity. Lock order is consistent and deadlocks bounded/reported.
6. Token expires/revoked/rotated/wrong email/forwarded/replayed after removal all fail safely; same-user committed accept retry works; unsigned/malicious return URLs remain rejected.
7. Email permanent/transient failure, idempotent in-process retry, unknown send outcome, manual resend, duplicate submission and provider success/database-status failure produce truthful states.
8. No invite secret in HTTP URLs, analytics, returned page props, action error state, browser storage, screenshots or logged request bodies/cookies. Test fragment handoff and email-client link preservation.
9. A/B simultaneous versioned checklist updates conflict without losing drafts; polling never silently overwrites unsaved checklist; switch flush failure leaves current workspace open; late old-company responses are ignored.
10. Owner deletion via Auth is blocked by restrictive FK; removing/leaving a member does not delete bids. User removal denies subsequent reads/writes even with a previously issued valid JWT.
11. Guest import names selected workspace, warns colleagues can see imported saves, requires explicit action, and never changes destination mid-batch.
12. No duplicate account providers/toast hosts; public tender browsing and separate admin flows remain functional. No notes UI returns.

## Environment and rollout

Reuse `CUSTOMER_AUTH_SITE_URL` as the canonical invitation origin. Do not build links from untrusted Host/X-Forwarded-Host or random preview URLs. Add server-only `RESEND_API_KEY` and sender config `WORKSPACE_INVITE_FROM=OpenBids <no-reply@openbid.co.za>`; configuration presence and actual send permission must be checked at implementation time. Use a dedicated sending key restricted to the verified domain; do not extract/reuse the hidden Supabase SMTP credential. Keep production/non-production credentials separate. Built-in fetch avoids a new dependency.

Do not add Vercel Cron, Supabase Edge Functions, email queues or a new database. Request-bound email plus stored invite state/manual resend is sufficient at the intended volume; document the crash-recovery limitation rather than pretending it is durable background delivery.

Use an isolated Supabase project and stable Preview domain with matching trusted origin/callback allowlists, Resend test credentials and controlled recipients. Current production database is not a development test target. Production migration/configuration/deployment requires a separate explicit execution request. Vercel default deployment domains have SSO protection according to current metadata: choose an intended tester-accessible Preview; do not weaken protection just to run tests.

Stage migration and prove old/new client compatibility first, then deploy membership-aware application behind a server-side feature flag. Enable invitation UI only after scoped RPC/RLS/bootstrap/FK, Resend configuration and real-flow tests pass. Safe fallback is disable invite/member-management entry points and keep the membership-aware application running. After shared memberships exist, rolling the whole app back to the old sole-owner implementation can lock members/owners out; do not use that as the rollback strategy. Retain data and additive schema.

Stop and report if live memberships/roles differ from this baseline, if ownership/migration-history invariants cannot be reconciled safely, if secure credential/environment separation is unavailable, or if an acceptance test requires unauthorised production writes. Do not resolve any of these by broadening privileges or discarding user data.

## Deliberately deferred

Dedicated profile/settings page; full #50/#51 security and prompt scope; email/password changes; account/workspace deletion and ownership transfer; custom roles/permissions; assignments and task owners; comments/notes/activity log; realtime/presence; member billing; invitation marketing; public join links; multiple owned workspace creation; automatic copying/merging of bids; background email queue/webhooks and guaranteed delivery.

The small workspace selector is included because existing users need a safe way to keep their current work and access a partner's workspace. Without it, a nominally simpler one-workspace design would need migration/abandonment rules or risk hiding existing bids.

## Official references checked

- Supabase RLS, private definer functions, grants and recursive policy pitfalls: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth invitations: https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail and official auth-js source https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueAdminApi.ts. Auth invitations are not workspace membership lifecycle; source documents no PKCE support for inviteUserByEmail. Recommendation is application invitations plus existing authentication, not a new Auth invitation path.
- Resend idempotency (24-hour deduplication, same key/payload): https://resend.com/docs/dashboard/emails/idempotency-keys
- Resend sending API: https://resend.com/docs/api-reference/emails/send-email
- Existing Supabase SMTP delivery separation: https://resend.com/docs/send-with-supabase-smtp
- Next.js Server Action authorisation and mutation boundaries: https://nextjs.org/docs/app/guides/data-security
- Vercel environment separation: https://vercel.com/docs/environment-variables
- Supabase changelog checked 15 October: https://supabase.com/changelog.md; recent TLS cipher deprecation is unrelated to the proposed schema/auth flow. Recheck documentation during implementation.
