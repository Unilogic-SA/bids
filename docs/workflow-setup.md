# Workflow setup and technical notes

The workflow is installed only for **Unilogic-SA/bids**.

## Daily operating model

Issues and the [Bids Development Project](https://github.com/users/Unilogic-SA/projects/1) track work. Direct owner `@codex` comments are the normal handoff:

- On an Issue: `@codex implement this Issue following AGENTS.md. Use a dedicated branch, open a PR that closes this Issue, and do not merge.`
- On its PR: `@codex fix the problem described above on this same PR; do not merge.`

The `needs-spec` and `codex-ready` labels remain available for optional organisation. They are not prerequisites for a Codex request. If Codex commits but its task has not published a PR, the owner clicks **Create PR** in that task.

## Project and release flow

GitHub's built-in Project workflows add new repository Issues and move closed Issues or merged PRs to Done. Intermediate Project statuses remain manual because the repository-scoped `GITHUB_TOKEN` does not have Projects access.

Repository automation keeps workflow labels useful: an owner Codex action request means `in-development`; current successful CI and Vercel Preview mean `ready-for-testing`; a new commit invalidates the old ready state. Human `changes-needed` and `approved` labels sync between one linked Issue and PR.

The owner tests the current Preview and deliberately merges. No automatic merge is enabled. The protected `main` ruleset requires a PR, an up-to-date branch, resolved review conversations, and successful **Quality** and **Vercel** checks.

## PR association

A PR should contain one local GitHub closing reference, such as `Closes #13`. Ordinary Markdown bullets and checklist formatting are accepted by the metadata automation. External repository references and ambiguous multiple closing references are ignored. GitHub performs the actual Issue closure after merge to `main`.

## Automation and permissions

- **CI:** contents read only; installs locked dependencies and runs the repository's available tests, lint, typecheck, and production build.
- **Issue/PR workflow:** contents read, Issues write, and Pull requests write. It responds only to owner action comments, same-repository PR events, and deliberate workflow labels.
- **Preview readiness:** contents, Actions, and Deployments read; Issues and Pull requests write. It requires current successful PR CI and a successful Vercel Preview.
- Privileged jobs check out `main`, disable persisted credentials, and never execute PR-controlled workflow code.
- Every job and API operation is restricted to `Unilogic-SA/bids`.
- GitHub Actions uses the repository-scoped `GITHUB_TOKEN`; there is no PAT or organisation-wide token.

## Vercel and Supabase

Vercel creates Preview deployments for PRs and deploys `main` to production. Public Supabase configuration may be available to Preview, but production write keys and `ETENDERS_SYNC_SECRET` must remain Production-only. This workflow does not run migrations, sync jobs, backfills, or production database writes.


