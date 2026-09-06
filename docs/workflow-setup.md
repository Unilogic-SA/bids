# One-time setup and technical notes

## Installation status
Prepared against Unilogic-SA/bids main commit `37ce96e5b7255dc675e77ed67ba51eb9785afb2a` on 6 September 2026.
The GitHub connector returned HTTP 403 “Resource not accessible by integration” for Issue and branch creation. These files are a prepared setup, not an installed or verified GitHub workflow.
Reconnect the GitHub integration for **only Unilogic-SA/bids**, allowing Contents, Issues, Pull requests and Workflows write access. No personal token needs to be pasted into chat. Then ask Codex to apply this prepared setup on a dedicated branch, create its tracking Issue/PR and wait for CI. Do not merge until checked.
Repository administration and Projects writes are not exposed by this connector; those dashboard settings are below.

## GitHub (after the setup PR is green and you approve its merge)
1. **bids → Actions → Issue and PR workflow → Run workflow → main → Run workflow.** This installs the 17 labels from [.github/labels.json](../.github/labels.json). It creates missing labels only and preserves existing ones.
2. **bids → Projects → Link a project**. Create/select a personal Project owned by Unilogic-SA, name it “bids development”, choose Board, and link only bids. In the board's Status field menu/Edit field, enter: Backlog, Needs Spec, Ready for Codex, In Development, Ready for Testing, Changes Needed, Approved, Done.
3. **Project → … → Workflows**: turn on “Item added to project” → Backlog, “Item closed” → Done and “Pull request merged” → Done. Add an **Auto-add to project** workflow, select **Unilogic-SA/bids**, filter `is:issue is:open`. Track Issues as the primary cards to avoid duplicate PR cards. Add existing Issues with **Add item → Add item from repository**, selecting only bids; auto-add does not backfill everything. If your plan lacks auto-add, select this Project when creating each Issue.
4. **bids → Settings → Branches → Add branch protection rule**, pattern **main**: require a PR, require status checks, select **Quality** from GitHub Actions after its first run, and require branches to be up to date. Leave force pushes and deletions disabled. Require conversation resolution. Do **not** require an approving reviewer for this solo-owner workflow: GitHub does not let a PR author approve their own PR. Do not enable automatic merge. Keep the owner's administrative recovery ability; do not enable “Do not allow bypassing” until comfortable with the workflow. The human gate is your deliberate merge after preview testing, not an enforceable separation of identities.
5. **Settings → General → Pull Requests**: enable squash merging if disabled, and optionally automatically delete head branches.

Board dragging alone does not apply labels or start Codex. Open the card to apply codex-ready. Intermediate board Status is manual; issue/PR labels carry the automated state. Built-in closure automation handles Done. Do not enable a workflow that closes Issues merely because you dragged a card to Done.

## Codex
Open Codex Cloud/settings and select or create an environment connected only to Unilogic-SA/bids. Use Node 24 and `npm ci` as its setup command; do not supply production database secrets. Enable Code review for this repository if you want PR mentions such as `@codex fix the CI failures`; automatic review is optional.
**Codex handoff requires this one manual action:** submit the Issue URL with the short implementation prompt in [the daily guide](development-workflow.md) to Codex Cloud with Unilogic-SA/bids selected.
The documented GitHub integration supports PR review and PR-context tasks. We did not establish a supported Issue-label/Project-status API that automatically creates a Codex Cloud task. No OpenAI credentials, invented API or paid agent runner is added.
Existing desktop skills are not guaranteed in Cloud. Install any needed specialised skills in that environment through supported Codex settings; AGENTS.md remains the permanent rules.

## Vercel
Open [bids settings](https://vercel.com/unilogics-projects/bids/settings).
1. **Settings → Git → Connected Git Repository**: confirm/connect **Unilogic-SA/bids**, granting the Vercel GitHub installation access only to bids.
2. **Settings → Environments → Production → Branch Tracking**: set/confirm **main**. Keep Preview deployments enabled for non-production branches. Keep fork deployment protection enabled.
3. **Settings → Environment Variables**: review the environment selection for each variable without copying values into Issues. Production write keys and ETENDERS_SYNC_SECRET must remain Production-only. For realistic write/admin testing, configure an isolated test Supabase environment in Preview; never copy the production write keys. If only public production read access is intentionally used, leave write/sync secrets absent and do not test admin mutations. Review NEXT_PUBLIC_SITE_URL for the preview environment too.
4. Open the first PR's Vercel preview link and verify it belongs to its newest commit. This confirms the actual Git integration.

Audit: project `prj_gEjK0dQPk5F0MnU5ce9KEhCI16KB`, team `team_N9W7PE1cYPQYlQVlmy2cmJTb`, Node 24, Next.js. Latest reported production deployment was READY for the audited main SHA, with source **cli**. Therefore automatic Git previews and environment scoping were **not confirmed**. The connector does not expose the needed settings writes or environment-target audit here.
No duplicate deployment Action or VERCEL_TOKEN is introduced.

## Automation and permissions
- CI: read-only Contents. Node 24, npm ci, existing lint, new `next typegen && tsc --noEmit`, existing webpack production build. No application test framework added and no production credentials. Node tests validate the automation and JSON-formatted YAML files.
- Metadata: Contents read, Issues write, Pull requests read. Issue intake, basic specification completeness check, exclusive workflow labels, same-repository PR association, stale approval removal on new commits and label cleanup on closure. Apply change/approval labels to the PR to mirror them to its Issue.
- Preview readiness: Contents/Actions/Deployments/Pull requests read and Issues write. Both CI completion and deployment-status events reconcile current open PRs. Requires successful latest PR CI for the current head, a successful latest **Preview** deployment from **vercel[bot]** at that SHA and an HTTPS vercel.app URL. Missing signals leave it in development; use the documented manual fallback. Never parses Vercel comments. Changes Needed/Approved are respected. Run “Preview readiness” manually to reconcile a missed event.
- Privileged jobs check out main only with credentials persistence disabled. They never install dependencies, run PR code, evaluate Issue text or accept repository names from Issues.
- All jobs and API operations explicitly restrict to Unilogic-SA/bids. GitHub Actions tokens are the only runtime credentials.
- Workflow files use JSON syntax, which is valid YAML, so they can be validated with built-in Node without adding a YAML dependency.
- Metadata and preview workflows activate on main; the initial setup PR cannot demonstrate those handlers before merge. CI itself runs on PRs and codex branches.
- Branch protection is still required to enforce green checks. Labels and AGENTS.md are guidance, not an independent security boundary. Anyone with repository admin/bypass access may override protection; an agent authenticated as the owner cannot be technically distinguished from the owner by these labels.
- Changes to workflow permissions or third-party Action versions deserve careful review. Actions use GitHub-maintained major release tags; pin to reviewed immutable SHAs if a stricter supply-chain policy is desired.

## Projects authentication
No PAT or GitHub App is introduced. Repository GITHUB_TOKEN cannot update Projects.
Built-in Project workflows and manual intermediate Status changes avoid an additional credential.
For a future user-Project API integration, GitHub's documented classic PAT approach needs `project` scope (write); it can reach other Projects the account can access and is not limited by a repo allowlist. This public repository would not need broad `repo` scope merely to read public Issues. For an organisation Project, GitHub recommends an App with organisation Projects read/write plus Issues/Pull requests read, installed only on the necessary repository. Project access remains a separate resource permission. Neither option is justified for this setup; obtain explicit approval before adding one.

## Supabase
Preserve migrations, RLS, the admin allowlist, Edge Function and cron conventions. No database or Supabase configuration changes are included. Future migrations require review, an isolated validation environment and explicit production approval. Never run existing cron/sync migrations blindly against a new environment: review their secrets and scheduled effects.
The application TypeScript configuration excludes supabase/functions; application CI does not validate Deno Edge Functions.

## Safe first test
Create a Feature / Improvement Issue titled **Workflow smoke test: add a help link to README**.
Problem: “I cannot easily find the daily development guide.”
Desired Outcome: “README links to docs/development-workflow.md.”
User Behaviour: “I click the link and find the daily steps.”
Acceptance Criteria: “One relative documentation link works; no app, database or environment changes.”
Out of Scope: “All product features and configuration changes.”
Run the normal handoff, check CI, open the unchanged application's preview, request a wording adjustment on the same PR to exercise Changes Needed, retest, approve and merge. If documentation-only deployments are skipped by Vercel, use its dashboard to redeploy that same branch as Preview; do not change product code just to force a preview.

## Sources
- [Codex Cloud](https://learn.chatgpt.com/docs/cloud)
- [Codex GitHub PR review and tasks](https://learn.chatgpt.com/docs/third-party/github)
- [GitHub Project built-in workflows](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations)
- [Projects authentication limits](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)
- [Vercel GitHub deployment integration](https://vercel.com/docs/git/vercel-for-github)

