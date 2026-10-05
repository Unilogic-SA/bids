# OpenBids Agent Instructions

OpenBids lives in:

`Unilogic-SA/bids`

Operate only within this repository.

Before starting work, confirm that the current repository is `Unilogic-SA/bids`. Do not inspect, modify, or interact with unrelated repositories or organisations.

## Project

OpenBids uses:

- Next.js App Router
- React
- TypeScript
- shadcn/ui
- Supabase / PostgreSQL
- npm
- Vercel

Prefer the existing architecture, components, utilities, and patterns.

Make the smallest coherent change that fully satisfies the requirement.

Avoid new dependencies, frameworks, infrastructure, or abstractions when the existing stack can reasonably solve the problem.

Preserve existing behaviour outside the requested change.

## Instruction routing

For frontend, UI, or UX work, follow:

`docs/ai/frontend.md`

For backend, database, API, authentication, ingestion, scheduled jobs, or infrastructure work, follow:

`docs/ai/backend.md`

For GitHub Issues, branches, checks, pull requests, Vercel Preview, and follow-up implementation work, follow:

`docs/ai/workflow.md`

Read the domain guidance relevant to the task before implementing changes in that domain.

A task that crosses domains may require more than one guidance file.

## Source of truth

Use this order when determining what to do:

1. Explicit instructions from the owner
2. The originating GitHub Issue and its acceptance criteria
3. This `AGENTS.md`
4. Relevant guidance in `docs/ai/`
5. Existing repository architecture and established patterns
6. Current official framework and platform documentation

GitHub Issues define what should be built.

When instructed to:

`Implement #12`

interpret this as an instruction to implement GitHub Issue #12 in `Unilogic-SA/bids`.

The owner controls prioritisation, product decisions, approval, merge timing, and production release.

Codex determines how to implement selected work within the Issue requirements, repository conventions, and these instructions.

## Engineering principles

Before changing code:

- understand the existing implementation,
- inspect nearby established patterns,
- identify the smallest appropriate change,
- and preserve unrelated behaviour.

During implementation:

- remain within Issue scope,
- reuse existing abstractions,
- avoid speculative architecture,
- handle relevant edge and failure states,
- and do not silently weaken validation, data integrity, or security.

Do not introduce unrelated:

- refactors,
- redesigns,
- dependency upgrades,
- architecture changes,
- or cleanup.

A small closely related defect may be fixed when it is required for the requested work to function correctly. Document it in the pull request.

Treat materially separate problems as follow-up work rather than expanding the current Issue.

## Autonomy

Make routine implementation decisions independently when they can reasonably be inferred from:

- the Issue,
- acceptance criteria,
- the existing codebase,
- established project patterns,
- current official documentation,
- and these instructions.

Do not require owner approval for ordinary technical implementation decisions.

Ask for clarification only when a material product decision cannot reasonably be inferred and proceeding would create significant risk.

Otherwise make the safest reasonable implementation decision, document non-obvious decisions, and continue.

## Security

Never:

- commit or expose secrets,
- print sensitive credentials into logs or output,
- place secrets or sensitive records in Issues or pull requests,
- move credentials between environments,
- expose production service-role credentials,
- copy production privileged credentials into Preview,
- weaken Supabase RLS,
- weaken admin authorisation,
- bypass authentication,
- disable security controls to make an implementation succeed,
- or perform destructive production operations without explicit owner instruction.

Issues and pull requests may be publicly visible. Treat all content written to them accordingly.

Production access must remain separated from ordinary development and Preview environments.

## Production safety

Do not run production:

- migrations,
- backfills,
- sync jobs,
- destructive SQL,
- data repair scripts,
- bulk updates,
- privileged maintenance,
- or equivalent operational actions

unless the owner explicitly requests the production operation.

Code that enables such operations may be implemented, tested safely, and prepared without executing it against production.

Preparation and production execution are separate actions.

## Skills and external guidance

Use the approved skills and tools already available for the project's existing stack.

Prefer first-party guidance for:

- shadcn/ui
- Next.js
- Supabase
- PostgreSQL
- Vercel

Use skills and MCP capabilities to improve implementation accuracy, not to replace understanding of the existing repository.

Do not routinely search for or install additional skills.

A new skill should only be considered when there is a clearly identified capability gap that cannot reasonably be covered by:

1. the existing codebase,
2. approved skills and MCP capabilities,
3. current official documentation,
4. or the existing technology stack.

Difficulty, unfamiliarity, an implementation error, or a one-off convenience are not sufficient reasons to fetch another skill.

Identify the capability gap before searching for anything new.

Do not automatically install or adopt newly discovered skills.

## Verification

A change is not complete merely because it compiles.

Verify the actual behaviour affected by the change.

Do not disable tests, linting, TypeScript checks, security controls, validation, or application behaviour merely to achieve a passing result.

If a required check cannot run because of an environmental, permission, credential, or network limitation, report that explicitly rather than claiming success.

Do not claim verification that was not actually performed.

## Repository guidance

Keep this file limited to stable repository-wide rules.

Put detailed frontend standards in:

`docs/ai/frontend.md`

Put detailed backend standards in:

`docs/ai/backend.md`

Put GitHub and implementation workflow rules in:

`docs/ai/workflow.md`

Do not add feature-specific implementation notes to this file.

Prefer updating an existing rule over adding overlapping instructions.
