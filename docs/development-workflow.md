# Your development workflow

Only use [Unilogic-SA/bids](https://github.com/Unilogic-SA/bids). See [one-time setup](workflow-setup.md) first.

## Daily use
1. Capture an unfinished thought with **Quick Idea / Backlog**, or use **Feature / Improvement** or **Bug** when the outcome is already clear. New Issues are added to Backlog automatically.
2. Describe the result you want and how you will recognise success. Use Needs Spec while deciding; the wording does not have to match a technical format.
3. When you are comfortable with the Issue, apply **codex-ready** and move Status to **Ready for Codex**. Your label is Gate 1: the automation may offer advice but will not move it back to Needs Spec.
4. On the Issue, add this comment, replacing only the number:
   > @codex Review and refine this Issue if needed, then implement it following AGENTS.md. Use a dedicated branch, open a PR with the standalone line Closes #NUMBER, and do not merge.
5. Your implementation comment changes the Issue label to **in-development** and launches a Codex Cloud task. When it finishes, open that task. Click **View PR** if a PR exists. If the task still shows **Create PR**, click it yourself once to publish the committed work; another GitHub comment cannot operate that button. A shell push warning does not mean the work is lost. Codex automatically reviews the published PR. The board's intermediate Status needs a manual move; labels do not automatically update it.
6. Open [My Action](https://github.com/users/Unilogic-SA/projects/1/views/2) to see work labelled **needs-spec**, **codex-ready**, **ready-for-testing**, **changes-needed**, or **approved**. For testing, open the Issue/PR labelled **ready-for-testing** and click its current Vercel preview link.
7. Test every acceptance criterion. Test preview, not the production site.
8. Wrong result? Describe what you saw on the **same PR**, apply **changes-needed** to the PR and move the board to Changes Needed. Comment `@codex fix the problems described above on this same PR; do not merge` when the Codex GitHub integration is enabled; otherwise send the PR URL and feedback to the existing Codex task.
9. Happy? Apply **approved** to the PR, record “I tested this preview and approve this revision for production”, and move the board to Approved. Confirm all required checks are green, then **Squash and merge → Confirm squash and merge** yourself. Keep the closing Issue reference in the PR.
10. GitHub closes the linked Issue on merge to main; the built-in Project workflow moves it to Done. Vercel deploys main when its Git integration is configured. Check that production deployment also succeeds.

A new commit invalidates your previous approval: test the new preview again. Green CI or an approved label never merges anything automatically.

## Capturing a rough idea
Use **Quick Idea / Backlog** when you want to record a thought without writing a full specification. It receives **needs-spec** automatically. Later, ask Codex:

> Turn this rough idea into a complete Feature Issue with a clear problem, desired outcome, user behaviour and testable acceptance criteria. Do not implement it.

Review the Issue yourself. If it already explains the result and success criteria well enough for you, you can skip a separate grooming round. Apply **codex-ready** only when you want implementation to begin, then use the combined review-and-implement comment above. Keep `Closes #NUMBER` as plain text; do not turn it into a link.

The Feature form applies **type:feature** automatically. The Bug form applies **type:bug** automatically.

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
**Workflow did not run:** check the Actions tab. If Codex says it committed but no PR exists, open the linked Codex task and click **Create PR** there. Do not ask Codex in another Issue comment to click its own task button.
**PR closed without merge:** the Issue stays open. Return it to Backlog or reopen the same PR.

## Never
- Commit directly to main or ask an agent to skip the PR.
- Paste secrets, passwords or private records into public Issues/PRs.
- Merge failing checks to “see if it works”, or merge a revision you have not tested.
- Use production write credentials or run production sync jobs while testing a preview.
