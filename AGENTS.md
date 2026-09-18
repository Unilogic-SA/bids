# Repository instructions

## Repository boundary
You are authorised to operate only on **Unilogic-SA/bids** (https://github.com/Unilogic-SA/bids).
Verify the repository before each task. Never inspect or modify unrelated repositories or organisations, even if credentials permit it. Scope every GitHub API request and search explicitly to this repository.
Never expose secrets, commit secrets, or move secrets between environments. Issues and PRs are public.

## Engineering
Prefer small, focused changes. Preserve the architecture unless the Issue requires a change.
Reuse existing components, utilities and patterns; avoid unnecessary dependencies and unrelated rewrites.
Never weaken security, authentication, authorisation, the admin allowlist or Supabase RLS.
This app uses Next.js App Router, React, TypeScript, shadcn/ui and npm. Commit package-lock.json when dependencies change.
Supabase migrations live in supabase/migrations; Edge Functions live in supabase/functions.
Future schema changes require a reviewed migration and explicit environment/deployment plan. Never run production migrations, sync jobs or backfills as part of ordinary CI or preview testing.
Production Supabase project: eanhpdxlskwxplglprrt. Preview must not receive its service-role key, secret key or ETENDERS_SYNC_SECRET. Public configuration does not grant permission to modify production data.

## Development workflow
Every implementation maps to an Issue in this repository. An explicit owner request, including an owner `@codex` action comment, authorises implementation.
Read the whole Issue and acceptance criteria. Refine missing detail in the Issue when needed, but do not reject an authorised task because its headings are informal.
Use a dedicated `codex/<issue-number>-<short-name>` branch from `main`; never implement directly on `main`.
Set `in-development` when starting and open a PR that contains one local GitHub closing reference such as `Closes #123`. Plain text, bullet, and checklist formatting are acceptable.
When a GitHub `@codex` task finishes without publishing, preserve the committed workspace and tell the owner to open that Codex task and click **Create PR**. Another GitHub comment cannot click the task UI.
Use exactly one originating Issue per PR. Keep fixes on the same branch and PR unless there is a clear reason to split them.
Never merge, enable auto-merge, approve on the owner's behalf, or apply `approved` without explicit human production approval for the current change.
After any new commit, prior Preview approval is stale: rerun checks and ask the owner to retest.
Do not treat a board status or bot review as production approval.

## Definition of Done
Use `npm ci`, `npm run lint`, `npm run typecheck` and `npm run build`.
Run `npm test` when that script exists. For automation changes run `node --test .github/scripts/*.test.cjs` and validate all workflow and Issue-form YAML.
CI runs without production secrets; Preview testing checks real runtime behaviour separately.
Supabase Edge Functions are excluded from the application's TypeScript check; changes there need separate appropriate Deno/Supabase validation.
Report failures honestly; do not disable rules or skip checks to get green CI.

## Pull requests
Fill in `.github/pull_request_template.md`: linked Issue, what changed and why, affected areas, UI impact, schema/migration impact, security/auth impact, tests/checks, Preview/screenshots where practical, limitations and follow-ups.
Never claim a Preview works unless verified for the current commit.

## Skills
Issue = what to build. AGENTS.md = permanent project conventions. Skill = specialised guidance.
Use relevant available skills for specialised work. Desktop-installed skills do not automatically exist in Codex Cloud. If required, install or configure them in the selected Cloud environment using supported Codex skill mechanisms.

## Code review rules
Flag cross-repository access, production credentials in Preview or CI, weakened RLS or auth, automatic merges, and privileged workflows that execute PR-controlled code.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

