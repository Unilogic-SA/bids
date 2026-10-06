# Development Workflow

This document defines how Issue-driven implementation work should move through `Unilogic-SA/bids`.

The standard workflow is:

**Issue → branch → implementation → checks → pull request → Vercel Preview → owner review → merge**

GitHub Issues are the source of truth for requested work.

The owner controls prioritisation, product approval, merge timing, and production release.

Codex is responsible for implementing selected work safely, independently, and completely within repository conventions.

## 1. Repository boundary

Operate only on:

`Unilogic-SA/bids`

Before starting work, confirm that the current repository is correct.

Do not inspect, modify, or interact with unrelated repositories or organisations.

Never expose, print, commit, or move secrets between environments.

Issues and pull requests may be publicly visible. Never place passwords, API secrets, private credentials, production service-role keys, or sensitive records in them.

## 2. Starting an Issue

When the owner says:

`Implement #12`

implement GitHub Issue #12 from:

`Unilogic-SA/bids`

Before making changes:

1. Read the entire Issue.
2. Read all acceptance criteria.
3. Read relevant linked context.
4. Inspect the affected existing implementation.
5. Read the applicable frontend and/or backend guidance.
6. Confirm the requested change is compatible with the current architecture.
7. Confirm the working tree can be changed safely.
8. Start from the latest `main`.
9. Create a dedicated branch for the Issue.

Do not begin implementation from an unrelated feature branch.

## 3. Git preparation

Before beginning a new Issue:

- ensure unrelated work is not mixed into the implementation,
- preserve any existing uncommitted work safely,
- switch to `main`,
- update `main`,
- and branch from the latest `main`.

Do not discard existing work merely to obtain a clean working tree.

Do not implement directly on `main`.

Do not reuse an old merged branch for new work.

Do not mix unrelated Issues on the same branch.

Do not force-push `main`.

Do not rewrite shared history unnecessarily.

If the current branch contains uncommitted or unrelated work, preserve it safely rather than discarding it.

## 4. Branch naming

Use:

`codex/<issue-number>-<short-description>`

Example:

`codex/12-sync-health-warning`

Keep the description concise, readable, and relevant to the Issue.

One originating Issue should normally map to one implementation branch.

## 5. Implementation scope

Implement only what is required to satisfy the Issue.

Use the Issue acceptance criteria as the primary definition of implementation success.

Prefer:

- small focused changes,
- existing architecture,
- established project patterns,
- existing components and utilities,
- and existing dependencies.

Do not introduce unrelated:

- refactors,
- redesigns,
- dependency upgrades,
- abstractions,
- cleanup,
- or architecture changes.

If a small closely related defect prevents the requested implementation from working correctly, fix it and disclose it in the pull request.

If a materially separate problem is discovered:

- do not expand the current Issue unnecessarily,
- document the finding,
- and identify it as follow-up work.

Preserve behaviour outside the requested change.

## 6. Independent implementation

The owner selects what should be built.

Codex owns routine technical implementation decisions.

Do not interrupt implementation for decisions that can reasonably be inferred from:

- the Issue,
- acceptance criteria,
- existing code,
- repository conventions,
- project guidance,
- or current official documentation.

Ask for clarification only when proceeding would require making a material product decision with meaningful risk that cannot reasonably be inferred.

Otherwise choose the safest reasonable implementation and continue.

Document non-obvious implementation decisions in the pull request.

## 7. Dependencies

Reuse existing dependencies whenever practical.

Do not add a dependency simply because it makes a small implementation easier.

Before adding a dependency, determine whether the requirement can reasonably be satisfied by:

- the platform,
- the current framework,
- an existing package,
- shadcn,
- Supabase,
- PostgreSQL,
- or existing project code.

When a new dependency is genuinely required:

- keep its scope narrow,
- prefer reputable and maintained packages,
- avoid overlapping libraries,
- and document the reason when it is material to review.

Do not perform unrelated dependency upgrades while implementing an Issue.

## 8. Definition of Done

Before considering implementation complete, run the appropriate repository checks.

The normal application validation baseline is:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

If a command does not exist in the repository, do not invent it. Report that it is unavailable.

If a command cannot complete because of:

- environment restrictions,
- missing credentials,
- permissions,
- network access,
- external service availability,
- or another external limitation,

report the limitation clearly.

Never report a check as passed unless it actually passed.

Do not disable:

- tests,
- lint rules,
- TypeScript checks,
- security controls,
- validation,
- or application behaviour

merely to produce a green result.

Use additional validation required by the affected technology.

For Supabase Edge Function changes, perform appropriate Supabase/Deno validation in addition to normal application checks.

For migration changes, clearly document migration and deployment implications.

## 9. Behaviour verification

Compilation is not sufficient verification.

Verify the behaviour that changed.

The depth of verification should match the scope of the Issue.

Examples:

- UI changes should verify the affected interaction and relevant responsive behaviour.
- API changes should verify the request and response path.
- Database changes should verify representative data behaviour.
- Authentication changes should verify relevant authorised and unauthorised states.
- Ingestion changes should verify the affected processing path and resulting data.
- Scheduled jobs should verify execution logic and resulting state without running production jobs unless explicitly authorised.
- Cross-layer features should verify the complete user story where practical.

Record meaningful verification results in the pull request.

Do not claim manual verification that was not performed.

## 10. Commits

Keep commits focused on the Issue.

Do not include unrelated generated files, local configuration, credentials, or personal environment files.

Use commit messages that describe the change clearly enough to understand the branch history.

Avoid unnecessary history rewriting after work has been shared.

## 11. Pull requests

Every implementation should result in one pull request for its originating Issue.

Use the repository's existing pull request template.

Include a GitHub closing reference:

`Closes #12`

The pull request should clearly describe:

- what changed,
- why it changed,
- the originating Issue,
- relevant implementation decisions,
- testing and verification performed,
- UI impact, if any,
- database or migration impact, if any,
- security or authentication impact, if any,
- known limitations,
- and relevant follow-up work.

Push the implementation branch and open the pull request when the work is ready for owner review.

Do not merge the pull request.

Do not enable auto-merge.

The owner decides when work is ready to merge and proceed toward production.

## 12. Vercel Preview

Vercel Preview is the primary owner-facing testing environment for pull requests.

A successful Preview deployment means the application deployed successfully.

It does not mean:

- the feature has been approved,
- the feature has been manually tested,
- or the implementation is ready for production.

Never claim Preview verification unless that Preview was actually tested.

When a new commit is pushed after:

- testing,
- review feedback,
- bug fixes,
- implementation changes,
- or conflict resolution,

treat previous Preview verification as stale.

The latest Preview represents the current implementation and should be verified again where appropriate.

## 13. Follow-up changes to an existing PR

When the owner requests revisions to an existing pull request, continue using the same branch and pull request unless there is a clear technical reason not to.

Examples:

- `Fix the mobile spacing on this PR.`
- `Address the review feedback.`
- `Resolve the conflicts on this PR.`
- `The Preview is still showing the old behaviour. Investigate and fix it.`

Do not create another pull request for the same originating Issue merely because revisions are required.

Push follow-up commits to the existing branch.

Re-run checks relevant to the changed code.

Treat previously completed verification as stale where the new commit affects what was previously tested.

## 14. Review feedback

When addressing review feedback:

1. Read the feedback in context.
2. Confirm whether it requires code, documentation, or explanation.
3. Make only the changes required to address the feedback and preserve Issue scope.
4. Re-run relevant checks.
5. Push to the existing branch.
6. Update the PR description or discussion when a material implementation decision changed.

Do not use review feedback as a reason to introduce unrelated cleanup.

## 15. Merge conflicts

When resolving conflicts:

1. update from the latest `main`,
2. understand both sides of the conflict,
3. preserve the intended behaviour of the Issue,
4. preserve unrelated changes already merged into `main`,
5. resolve deliberately rather than mechanically,
6. rerun relevant checks,
7. and reverify affected behaviour.

Do not blindly choose one side of a conflict.

Do not remove newer `main` behaviour merely to make the feature branch apply cleanly.

## 16. Production operations

Normal Issue implementation stops at a reviewable pull request and Preview.

Do not perform production deployment or destructive production operations unless the owner explicitly requests them.

In particular, do not automatically execute:

- production migrations,
- production database modifications,
- production backfills,
- production sync jobs,
- destructive data operations,
- privileged production maintenance,
- or equivalent operational work.

Preparation and production execution are separate actions.

A pull request that contains production-operational code does not authorise running that code against production.

## 17. Failed checks and blockers

When implementation cannot be completed normally, report:

- what failed,
- the concrete evidence,
- what was attempted,
- what remains unverified,
- and what external dependency, access limitation, or decision is blocking completion.

Do not conceal failed checks.

Do not describe assumptions as verified facts.

Do not repeatedly retry the same failed approach without gathering new evidence.

If a failure is environmental rather than code-related, preserve the working implementation and report the environmental limitation clearly.

## 18. Security during workflow

Never:

- commit secrets,
- expose production credentials,
- copy production service-role credentials into Preview,
- place credentials into Issues or pull requests,
- weaken Supabase RLS,
- weaken admin authorisation,
- bypass authentication,
- disable security controls to make checks pass,
- or run destructive production operations without explicit owner instruction.

When debugging, redact sensitive values from logs, screenshots, comments, and PR descriptions.

Do not move secrets between development, Preview, and Production to work around configuration problems.

## 19. Issue completion

An Issue implementation is ready for owner review when:

- the requested scope has been implemented,
- acceptance criteria have been addressed,
- relevant repository checks have completed or their limitations are documented,
- affected behaviour has been verified to an appropriate extent,
- security and data implications have been considered,
- the branch has been pushed,
- one pull request has been opened,
- the PR contains the closing reference,
- and the latest Preview is available when Vercel successfully deploys it.

Do not merge.

The owner decides whether the Issue is accepted.

## 20. Workflow principle

Keep the workflow predictable:

**Issue → branch → implementation → checks → PR → Preview → owner review → merge**

Avoid adding process that does not materially improve correctness, security, traceability, or reviewability.

GitHub Issues are the source of truth for requested work.

The owner controls prioritisation and production approval.

Codex should focus on implementing the selected Issue safely, independently, and completely.
