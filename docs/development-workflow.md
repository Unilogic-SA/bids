# Your development workflow

Only use [Unilogic-SA/bids](https://github.com/Unilogic-SA/bids).

## The short version

1. Create an Issue using **Quick Idea**, **Feature / Improvement**, or **Bug**.
2. When you want Codex to build it, comment:

   > @codex implement this Issue following AGENTS.md. Use a dedicated branch, open a PR that closes this Issue, and do not merge.

3. If the Codex task shows **Create PR**, click it once. Otherwise click **View PR**.
4. Wait for green **Quality**, a successful Vercel Preview, and the automatic Codex review.
5. Open the Vercel Preview from the PR and test the Issue's acceptance criteria.
6. If something is wrong, explain it on the same PR and comment:

   > @codex fix the problem described above on this same PR; do not merge.

7. Test the new Preview. When satisfied, explicitly approve the current revision and squash-merge it.
8. GitHub closes the linked Issue, the Project moves it to Done, and Vercel deploys `main` to production.

That is the normal workflow. Project statuses and labels are useful for visibility, but they do not launch Codex and you do not need to move every status before talking to Codex.

## What happens automatically

- An owner `@codex` build, implement, fix, change, update, continue, or resolve comment marks the relevant Issue and PR `in-development`.
- A PR linked to one local Issue is kept in the same workflow. `Closes #13` may be plain text, a bullet, or a checklist item.
- Every PR runs CI. Vercel creates a Preview. Codex reviews the PR.
- Current green CI plus a successful current Vercel Preview changes the PR and Issue to `ready-for-testing` and posts the Preview link.
- A new commit returns the work to `in-development`, so an old approval cannot apply to new code.
- A merged PR closes its linked Issue when the PR contains a GitHub closing reference, and the Project's built-in workflow moves closed work to Done.

## What you control

- Use the Project to organise and view work. Intermediate Project statuses remain manual.
- Use `needs-spec` or `codex-ready` only when they help you; neither is required before an owner `@codex implement` comment.
- Apply `changes-needed` or `approved` when useful. These labels sync between a linked PR and Issue.
- Only you provide production approval. Nothing auto-merges.

## When something goes wrong

**Codex committed but there is no PR:** open the linked Codex task and click **Create PR**.

**Red Quality check:** do not merge. Comment `@codex fix the failing CI check on this same PR; do not merge`.

**Wrong Preview:** describe expected versus actual behaviour on the PR, then use the fix comment above.

**No ready-for-testing label:** confirm the PR links one Issue with `Closes #NUMBER`, and confirm Quality and Vercel are green for the latest commit.

**Unresolved Codex review:** ask Codex to fix it on the same PR, then resolve the conversation after the fix is present.

## Never

- Commit directly to `main` or ask an agent to bypass the PR.
- Paste secrets, passwords, private records, or production credentials into Issues or PRs.
- Merge failing checks or a revision you have not tested.
- Run production sync jobs, migrations, or backfills while testing a Preview.


