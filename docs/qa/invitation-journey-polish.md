# Invitation journey refinement

Scope: issue #79, 16 October 2026. The owner confirmed the existing invitation
journey works; this pass changes hierarchy, presentation and completion feedback.

## Impeccable direction

Used the project-scoped Impeccable context launcher, PRODUCT.md, DESIGN.md and
the distill, delight, animate, polish and audit playbooks. Mode: Operate.

- Workspace management opens on Workspace, with its invitation form first.
  Pending invitations stay beside that form; roster and naming are secondary.
- The recipient sees a centered, responsive invitation with the inviter and
  workspace name, one primary action, and explicit sharing/privacy information.
- Confirmed acceptance earns one 750ms purple burst around the check mark.
  Completion copy and Open workspace are immediately available. Reduced motion
  removes the burst and retains the same confirmation; there is no sound, delay,
  animation dependency, repeated loop or persistent celebration flag.
- Unavailable, signed-out, wrong-account, pending and failure paths remain
  explicit. Account remains accessible in its tab. Rename feedback stays with
  rename, and invitation feedback stays with the invitation form.

## Implementation boundary

The same server action still verifies the fresh user, pending token and database
acceptance, selects the returned workspace, and clears the pending cookie. Only
its successful presentation outcome changes: it returns confirmed success to
the invitation view instead of immediately redirecting. Open workspace performs
a fresh navigation so account/workspace providers resolve the selected scope.
The client retains only the initial workspace display name across the cookie
re-render; token and full invited email are not serialized into client props.

No database, RLS, authentication checks, sending integration, expiry, credential,
dependency, email template or analytics changes are included.

## Verification boundaries

Review covers labelled forms, keyboard focus on completion, bounded wrapping,
existing semantic tokens in both themes, mobile-width action sizing, finite
motion and its reduced-motion alternative. Existing SQL/auth/lifecycle tests
remain the behavioral regression suite.

File-based synthetic browser rendering was blocked by the browser URL policy;
it was not bypassed. A clean source scan and successful build do not prove
rendered mobile or live acceptance behavior. Exact-commit Preview and production
browser evidence, check results and any remaining limitations are recorded in
the pull request. No live invitation is sent without a specified recipient.
