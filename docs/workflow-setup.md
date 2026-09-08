# One-time setup and technical notes

## Installation status

The workflow is installed for **Unilogic-SA/bids**.

- Setup PR [#2](https://github.com/Unilogic-SA/bids/pull/2) was squash-merged to `main` as `e7705cce183dd60e3e5be60de5b3f4615b4c0fcb`.
- GitHub CI and the Vercel production deployment succeeded for that commit.
- The 17 repository workflow labels are installed from `.github/labels.json`.
- [Bids Development](https://github.com/users/Unilogic-SA/projects/1/views/1) is linked only to this repository.
- The active [Protect main ruleset](https://github.com/Unilogic-SA/bids/settings/rules/22393703) requires a PR, an up-to-date branch, resolved review conversations, and successful **Quality** and **Vercel** checks. It blocks deletion and force pushes.
- No automatic merge is enabled. The owner must test and deliberately merge each production change.

## GitHub Project

The board statuses are:

`Backlog → Needs Spec → Ready for Codex → In Development → Ready for Testing → Changes Needed → Approved → Done`

Built-in Project workflows add new open Issues from **Unilogic-SA/bids**, set new items to Backlog, and set closed Issues or merged PRs to Done. Intermediate Project Status changes remain manual. Repository labels carry the automated workflow state.

Board dragging alone does not start Codex. Open the Issue and apply **codex-ready** when implementation is authorised. Do not move an Issue to Done to close it; merge a PR containing `Closes #NUMBER` or close the Issue deliberately.

## Codex Cloud

A Codex Cloud environment connected to **Unilogic-SA/bids** exists. Keep it limited to this repository and do not add production database secrets.

**Codex handoff requires one deliberate owner action:** add this comment to the ready Issue, replacing only the number:

> @codex Implement this Issue following AGENTS.md. Use a dedicated branch, open a PR with the standalone line Closes #NUMBER, and do not merge.

This supported GitHub mention launches a repository-scoped Codex Cloud task. When it finishes, use **View PR**. If it committed the work but reports that shell push credentials are unavailable, click **Create PR** in the task; do not recreate the code or add a GitHub token. Applying `codex-ready` alone does not launch Codex, which preserves the owner's development gate. Existing desktop skills are not guaranteed in Cloud; configure a specialised skill there only when a task needs it.

## Vercel

Vercel is connected to **Unilogic-SA/bids**. Pull requests create Preview deployments and `main` is the production branch.

The public Supabase URL and publishable key are available to Production and Preview as Vercel Config values. Production write keys and `ETENDERS_SYNC_SECRET` must remain Production-only. Never copy secrets into Issues, PRs, repository files, or Codex Cloud.

For every PR, test the Preview deployment for the newest commit. A new commit invalidates the previous approval. Production deploys after the owner deliberately merges an approved PR.

## Automation and permissions

- **CI:** Contents read only. Node 24, `npm ci`, automation tests, lint, typecheck, and production build.
- **Issue/PR workflow:** Contents read, Issues write, Pull requests write. It handles intake, specification checks, exclusive workflow labels, same-repository PR association, stale approval removal, and label cleanup.
- **Preview readiness:** Contents, Actions, and Deployments read; Issues and Pull requests write. It requires current successful PR CI and a successful Vercel Preview deployment.
- Privileged jobs check out `main` only, disable persisted credentials, and never run PR-controlled code.
- Every job and API operation is explicitly restricted to `Unilogic-SA/bids`.
- GitHub Actions uses only its repository-scoped `GITHUB_TOKEN`. No PAT or extra GitHub App token was added.
- Project Status sync uses GitHub's built-in workflows because repository `GITHUB_TOKEN` does not grant Projects access.

Anyone who controls repository or Project settings can alter these protections, so keep administrative access limited and review changes to workflow permissions carefully.

## Supabase

No database or Supabase configuration was changed. Preserve migrations, RLS, the admin allowlist, Edge Function, and cron conventions. Future schema changes require a reviewed migration, isolated validation, and explicit production approval. Application CI does not validate Deno Edge Functions.

## Safe first test

Create a Feature / Improvement Issue titled **Workflow smoke test: add a help link to README**.

- **Problem:** I cannot easily find the daily development guide.
- **Desired Outcome:** README links to `docs/development-workflow.md`.
- **User Behaviour:** I click the link and find the daily steps.
- **Acceptance Criteria:** One relative documentation link works; no app, database, or environment changes.
- **Out of Scope:** All product features and configuration changes.

Use the normal handoff. Check CI and the current Vercel Preview, request one wording adjustment on the same PR to exercise Changes Needed, retest, approve, and merge.
