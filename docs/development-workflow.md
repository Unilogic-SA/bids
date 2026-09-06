# Your development workflow

Only use [Unilogic-SA/bids](https://github.com/Unilogic-SA/bids). See [one-time setup](workflow-setup.md) first.

## Daily use
1. Add an idea as a Feature / Improvement or Bug Issue. Add it to the board's Backlog.
2. Describe the outcome and acceptance criteria. Use Needs Spec while deciding.
3. When ready, open the Issue inside the board and apply **codex-ready**; move Status to **Ready for Codex**.
4. In Codex Cloud, select **Unilogic-SA/bids** and submit this prompt with the Issue URL:
   > Implement ISSUE_URL following AGENTS.md. Use a dedicated branch, open a PR linked with Closes #NUMBER, and do not merge.
5. Codex starts implementation and opens a PR. Labels track development. The board's intermediate Status needs a manual move; labels do not automatically update it.
6. Open the Issue/PR labelled **ready-for-testing**. Click its current Vercel preview link. If no trusted deployment signal is available, wait for green CI and a successful current preview, then apply that label yourself.
7. Test every acceptance criterion. Test preview, not the production site.
8. Wrong result? Describe what you saw on the **same PR**, apply **changes-needed** to the PR and move the board to Changes Needed. Comment `@codex fix the problems described above on this same PR; do not merge` when the Codex GitHub integration is enabled; otherwise send the PR URL and feedback to the existing Codex task.
9. Happy? Apply **approved** to the PR, record “I tested this preview and approve this revision for production”, and move the board to Approved. Confirm all required checks are green, then **Squash and merge → Confirm squash and merge** yourself. Keep the closing Issue reference in the PR.
10. GitHub closes the linked Issue on merge to main; the built-in Project workflow moves it to Done. Vercel deploys main when its Git integration is configured. Check that production deployment also succeeds.

A new commit invalidates your previous approval: test the new preview again. Green CI or an approved label never merges anything automatically.

## Status meanings
| Status | Meaning |
| --- | --- |
| Backlog | An idea; no work authorised |
| Needs Spec | Clarify the desired result |
| Ready for Codex | Owner authorises implementation; apply codex-ready and hand off |
| In Development | Codex is coding or checks are running |
| Ready for Testing | Latest build and preview are ready for you |
| Changes Needed | Describe a correction on the same PR |
| Approved | You tested this revision; ready for your deliberate merge |
| Done | Issue closed after merge; check production deployment |

## When something goes wrong
**Red build:** do not merge. Open the failed check's Details and send its URL to the existing Codex task, or comment `@codex fix the CI failures; do not merge` on the PR when enabled.
**Wrong preview:** add expected versus actual behaviour and a screenshot without private information; request changes on the same PR.
**No preview:** check the Vercel setup checklist. Do not approve an untested change.
**Workflow did not run:** check the Actions tab. Metadata workflows activate only after setup reaches main; run label setup once first.
**PR closed without merge:** the Issue stays open. Return it to Backlog or reopen the same PR.

## Never
- Commit directly to main or ask an agent to skip the PR.
- Paste secrets, passwords or private records into public Issues/PRs.
- Merge failing checks to “see if it works”, or merge a revision you have not tested.
- Use production write credentials or run production sync jobs while testing a preview.

