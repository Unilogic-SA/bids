# Implementation plans

| Plan | Status | Implementation |
| --- | --- | --- |
| [#48: Customer authentication and company workspace](https://github.com/Unilogic-SA/bids/issues/48) | Foundation implemented for review; external provider verification pending | #49: additive schema, sessions, email/Google authentication and recovery. #50 account settings/security and #51 account menu/prompts remain deferred until their preceding PRs merge. |
| [#59: Account-backed bid workspace](https://github.com/Unilogic-SA/bids/issues/59) | IN PROGRESS — implemented; owner Preview verification pending | Account-backed saves/import, bid preparation, List and Board. Additive `20261012112923_bid_workspace` migration applied. Automated database/application checks passed; full signed-in browser QA remains pending because local Chromium could not be installed. Application release awaits owner review. |
| [003: Shared workspaces and invitations MVP](003-shared-workspaces-mvp.md) | IMPLEMENTED — release verification in progress, 15 October 2026 | Owner authorised full implementation and release. Membership-aware app, scoped bid RPCs, invitation lifecycle and compact Account/Workspace modal implemented. Production migration `20261015124223` applied; rolled-back live access/lifecycle checks passed and existing data unchanged. Invitation email activation requires the dedicated production Resend sending key. |

The master issue retains the complete authoritative plan. #49 closes only its
child issue after owner review; it does not complete or close #48. Its remaining
account-settings and prompt work is separate from the bid workspace.
