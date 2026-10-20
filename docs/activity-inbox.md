# Activity attention inbox

The existing header Activity icon opens a desktop shadcn Popover or mobile Drawer.
The scope is the currently selected workspace, explicitly named in the panel.
Nothing is sent by email, push, Slack, or another channel.

## Notification policy

- Only post-baseline closing-date amendments (both timestamps known, same source
  mode) and explicit raw source cancelled/canceled/withdrawn transitions create
  source events. The importer normalises these statuses to derived "closed", so
  cancellation must inspect raw status rather than derived_status.
- Source absence, null deadlines, metadata edits, normal expiry and first catalog
  inserts are not source events. A source-mode switch silently resets change
  events rather than asserting that the authority amended something.
- One 24-hour submission reminder is computed for Reviewing/Preparing/Ready bids.
  Saved-only, submitted, archived, outcome and cancelled bids get no reminder.
  The same deadline has the same reminder key before and after closing; passing
  closing time updates its message without making it unread again. Overdue
  reminders expire after seven days.
- Related reasons group into one bid row. Cancellation supersedes deadline and
  submission reasons. Ended bids discard old source events.
- Read, dismiss, one-hour snooze and preferences are personal, persisted across
  devices. None changes shared deadline acknowledgement, submission or attendance.
  A new source transition gets a new key and can surface through an old snooze.
  Stale clients can acknowledge only the exact keys they saw.
- Member join time is a silent baseline for source events. Current reminders
  remain useful to new members. Membership removal cascades personal state.
- Preferences independently enable material changes and submission reminders per
  person/workspace. Briefing monitoring, document changes, saved-only opt-in,
  outbound delivery and a general collaboration audit log remain outside V1.

## Architecture and security

Migration `20261020184000_activity_inbox.sql` adds RLS-protected source events,
personal state and preferences. A trigger records meaningful source transitions
in the same transaction as accepted catalog updates, covering both import paths.
Unique (bid_id,kind) rows retain the current transition, not an unbounded event log.
The trigger helper is private, takes no actor/company input, uses an empty
search_path, and is not executable by API roles.

Read/mutation RPCs run as SECURITY INVOKER under live verified membership RLS.
No privileged credential is needed by the Activity API. POST validates same-origin
requests, schema, payload size and exact event keys. Reads use no-store and return
20 grouped bids with workspace-wide unread counts. Dates use SAST.

Reminders are deterministic server-time conditions rather than scheduled
notifications. This deliberately needs no cron: no message has to be delivered
while the app is closed. On returning, the server evaluates current relevance.
Repeated reads do not create events. The header refreshes while visible/online
every 60 seconds, every 30 seconds while open, and on focus/connectivity return.
Requests are aborted and state discarded on user/workspace changes. Navigation
uses the existing checklist leave guard and an exact current-workspace bid URL.

The current source archive is not a complete chronological history; it is not
used as an event trigger. Source coverage can still miss authority updates,
especially historical closed records. Activity cannot guarantee detection of
every procurement change.

## Rollout and verification

Apply the additive migration in an isolated non-production database before
testing the app. Existing bid contents, source history and shared acknowledgement
are unchanged. Initial deployment does not generate historical change events;
already-due active bid reminders appear normally.

The migration file was prepared through the repository API because this session
had no execution environment and could not run the Supabase migration CLI.
Validate migration ordering against the target before application. Do not run
a blanket production db push. Production migration execution requires the
owner's explicit production instruction; merge is owner-controlled.

Run `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`. The PGlite suite covers silent baselines, refresh deduplication,
personal read/snooze/dismiss, stale acknowledgements, source switch baselines,
active-reminder lifecycle, explicit cancellation, missing sources, preferences,
pagination, unverified/anonymous/cross-workspace/removed-member access and event
write restrictions. It uses synthetic Auth/catalog fixtures and no live services.

Verify desktop/mobile keyboard and touch operation, focus restoration, long
titles, loading/error/empty/offline states, cross-device read state, both workspace
switching and checklist-save failure, and scope removal on the latest Preview.
A successful CI/build does not establish rendered or real-auth verification.
