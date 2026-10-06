# Backend Engineering

This document defines how backend, database, API, authentication, ingestion, scheduled-job, and infrastructure work should be implemented in OpenBids.

The primary backend stack is:

- Next.js
- Supabase
- PostgreSQL
- Vercel

Use the existing architecture before introducing new backend infrastructure.

The objective is a backend that is secure, reproducible, observable, maintainable, and safe to operate.

## 1. Approved backend guidance

For backend work, use the existing approved skills and tools relevant to the task.

Primary authorities include:

- the official Supabase skill for Supabase-related work,
- Supabase MCP capabilities for current documentation, project inspection, SQL execution, and advisor checks when appropriate,
- Supabase/PostgreSQL best-practice guidance for schema design, SQL, indexing, RLS, and query performance,
- the approved Next.js skill for App Router server behaviour, Server Components, Server Actions, Route Handlers, caching, rendering, and runtime patterns,
- relevant Vercel skills for Functions, Cron, environment variables, observability, deployment behaviour, and end-to-end verification.

Do not search for or install additional skills as part of normal implementation.

Assume the existing stack and approved guidance are sufficient unless there is strong evidence of a genuine capability gap.

Difficulty, unfamiliarity, or an error are not evidence that a new skill is required.

## 2. Repository-specific backend conventions

Supabase migrations live in:

`supabase/migrations`

Supabase Edge Functions live in:

`supabase/functions`

Preserve these locations and established repository conventions.

Do not create parallel migration systems or alternative locations for the same concerns.

## 3. Understand before changing

Before modifying backend behaviour, establish:

- the current data flow,
- the system of record,
- the relevant schema and relationships,
- the current authentication boundary,
- the current authorisation boundary,
- existing RLS policies,
- relevant migrations,
- existing API or server patterns,
- scheduled or background dependencies,
- and the expected production behaviour.

Prefer extending an established pattern over introducing a second way of solving the same problem.

Do not change architecture merely because another pattern is theoretically cleaner.

## 4. Supabase is the data authority

Treat Supabase/PostgreSQL as the source of truth for application data unless the repository explicitly establishes another source for a specific workflow.

Before changing Supabase behaviour:

1. Inspect the existing schema, migrations, policies, and data-access patterns.
2. Use the approved Supabase guidance and MCP capabilities when relevant.
3. Consult current official Supabase documentation for version-sensitive behaviour.
4. Preserve RLS and existing security boundaries.
5. Verify the resulting behaviour.

Do not guess Supabase APIs, CLI commands, or current platform behaviour when current documentation or tooling is available.

Supabase evolves quickly. Prefer current official behaviour over remembered behaviour.

## 5. Database changes and migrations

All persistent schema changes must be reproducible from repository migrations.

Do not create production-only schema state that is absent from migration history.

For schema work:

- prefer additive and backwards-compatible changes,
- preserve existing data,
- consider deployment order,
- consider rollback and recovery implications,
- use clear constraints,
- use foreign keys where relationships should be enforced,
- use appropriate nullability,
- add indexes intentionally,
- and verify the resulting schema.

Do not manually invent migration conventions when the repository or current Supabase tooling already defines them.

Do not drop tables, columns, constraints, or production data merely to resolve an implementation problem.

When a destructive change is genuinely required, treat it as a material change and document:

- data impact,
- migration sequence,
- deployment implications,
- and recovery considerations.

Do not execute production migrations unless the owner explicitly requests production execution.

## 6. Data integrity

The database should enforce important invariants whenever practical.

Use appropriate:

- primary keys,
- foreign keys,
- unique constraints,
- check constraints,
- nullability,
- transactions,
- and database-level duplicate protection.

Do not rely solely on frontend validation to preserve valid database state.

Design mutations so partial execution cannot silently produce corrupt state.

When a workflow requires multiple related mutations to succeed together, consider a transaction or another atomic database pattern.

Prefer database-enforced uniqueness over application assumptions.

## 7. Security model

Security must be enforced server-side and at the data boundary.

Authentication establishes identity.

Authorisation determines what that identity may access or change.

Do not treat authentication alone as authorisation.

For exposed Supabase schemas:

- maintain Row Level Security,
- use least-privilege policies,
- scope access to the actual data relationship,
- and review read and write paths separately.

Do not weaken RLS to make an implementation work.

Do not bypass authorisation failures with privileged credentials unless the architecture explicitly requires a trusted server-side operation and that operation is appropriately protected.

Never expose Supabase service-role or equivalent privileged credentials to the client.

Never put secrets in `NEXT_PUBLIC_*` environment variables.

Do not trust ownership identifiers, user IDs, roles, or privileged flags supplied by the client.

Derive trusted identity and authorisation context from secure server/session/database state.

## 8. Privileged database code

Treat privileged SQL functions, elevated roles, and RLS-bypassing mechanisms as high-risk.

Do not introduce privileged database behaviour merely to resolve a permission error.

Where elevated behaviour is genuinely necessary:

- keep the scope narrow,
- verify the caller,
- expose the smallest required surface,
- document why elevation is needed,
- and verify it cannot be invoked more broadly than intended.

Prefer normal RLS-compatible access patterns when they satisfy the requirement.

## 9. Supabase Edge Functions

For changes under:

`supabase/functions`

perform appropriate Supabase and Deno validation in addition to normal application checks.

Edge Functions should:

- validate inputs,
- keep privileged credentials server-side,
- avoid leaking internal errors,
- return deliberate HTTP status codes,
- handle expected upstream failures,
- and provide enough logging to diagnose operational problems.

Do not copy production secrets into development or Preview environments.

Do not assume Node.js-only APIs are available inside a Deno-based function.

Use current Supabase documentation for runtime-specific behaviour.

## 10. Next.js server-side architecture

Use the simplest server-side primitive that satisfies the requirement.

Prefer established repository patterns first.

As a general guide:

- use Server Components for server-side reads used directly in rendering,
- use Server Actions for application mutations initiated from the UI when that pattern fits the existing architecture,
- use Route Handlers for HTTP/API boundaries, integrations, webhooks, and externally callable endpoints,
- use Vercel Cron for scheduled HTTP invocation when appropriate,
- and introduce queues or durable workflows only when the workload actually requires them.

Keep privileged operations on the server.

Do not expose server-only implementation details to Client Components merely for convenience.

## 11. Current Next.js behaviour

This repository may use Next.js behaviour newer than model training knowledge.

For work involving:

- App Router,
- Server Components,
- Server Actions,
- Route Handlers,
- caching,
- revalidation,
- rendering,
- runtime selection,
- middleware/proxy behaviour,
- headers,
- cookies,
- or other framework-specific APIs,

use the approved Next.js skill and consult current version-appropriate documentation before relying on remembered behaviour.

Respect existing repository patterns and current deprecation guidance.

Do not replace a working established pattern merely because a newer alternative exists unless the Issue requires it or the existing pattern is no longer valid.

## 12. Data access

Queries should be explicit, bounded, and designed around real application access patterns.

Avoid:

- unnecessary `select *`,
- unbounded queries,
- N+1 patterns,
- repeatedly fetching the same data,
- filtering large datasets in application memory when PostgreSQL can do it efficiently,
- and unnecessary sequential database calls that can safely run concurrently.

Use pagination for potentially large collections.

Retrieve only the fields required for the operation where practical.

Push filtering, sorting, joins, and aggregation into PostgreSQL when appropriate.

Add indexes for frequently filtered, joined, or sorted columns when justified by the workload.

Do not add indexes automatically to every column.

Optimise from evidence, not intuition.

For materially expensive queries, inspect actual query behaviour or plans when practical.

## 13. Reliability

Backend operations should behave predictably under:

- retries,
- duplicate requests,
- partial failures,
- slow dependencies,
- process termination,
- and transient external failures.

Where applicable:

- make ingestion and scheduled jobs idempotent,
- validate inputs at trust boundaries,
- use transactions where operations must succeed or fail together,
- use bounded retries,
- prevent duplicate records with constraints,
- make repeated requests safe when feasible,
- and preserve useful checkpoints for long-running work.

A retry must not silently corrupt state.

Do not implement infinite retries.

Do not hide repeated operational failures behind retry loops.

## 14. Ingestion and synchronisation

Tender ingestion and synchronisation are core product infrastructure.

Treat ingestion work as production-critical backend work.

Design ingestion so that it can tolerate:

- API pagination,
- transient upstream failures,
- partial upstream responses,
- duplicate upstream records,
- repeated runs,
- interrupted runs,
- and records that change between runs.

Prefer stable source identifiers and database-level uniqueness for deduplication.

Where a process spans meaningful amounts of work, preserve enough state or checkpoints to understand where processing stopped and whether it is safe to resume.

Keep processing units reasonably bounded.

Do not run production backfills or production sync jobs unless the owner explicitly requests that production operation.

Implementation and execution are separate actions.

## 15. Scheduled jobs

For Vercel Cron or similar scheduled execution:

- use the existing project scheduling pattern,
- protect scheduled endpoints from unauthorised invocation,
- keep handlers idempotent where practical,
- make failure visible,
- and avoid assuming scheduled execution guarantees exactly-once processing.

Scheduled jobs should be safe to retry.

Do not treat a cron invocation as proof the underlying work succeeded.

Verify resulting state where practical.

## 16. Error handling

Do not silently swallow errors.

Distinguish:

- expected user/application failures,
- expected operational failures,
- external dependency failures,
- and unexpected programming failures.

Return useful but safe errors at system boundaries.

Do not expose:

- stack traces,
- SQL internals,
- secrets,
- privileged configuration,
- or unnecessary infrastructure details

to end users.

Log enough server-side context to diagnose failures without leaking sensitive information.

When repeated attempts fail, investigate the underlying state rather than increasing retries.

## 17. Environment configuration

Development, Preview, and Production are separate environments.

Do not assume configuration present locally exists in Vercel.

Keep secrets outside version control.

Distinguish public browser configuration from server-only configuration.

Never move production privileged secrets into Preview for convenience.

When behaviour differs between environments, inspect the actual environment configuration before changing code.

Do not solve an environment mismatch by weakening production security.

## 18. Observability

Important backend operations should leave enough evidence to diagnose failures.

Prefer structured logging.

Important flows should make it possible to determine:

- what operation ran,
- when it started,
- whether it completed,
- what was processed,
- how much was processed,
- what succeeded,
- what failed,
- where processing stopped,
- and whether retrying is safe.

Use stable identifiers or correlation/run identifiers where useful.

Avoid noisy logs with no diagnostic value.

Never log:

- passwords,
- API secrets,
- service-role credentials,
- session tokens,
- or sensitive records unnecessarily.

For production incidents or unclear failures, prefer checking actual runtime/log evidence before editing code speculatively.

## 19. Production operations

Do not execute production:

- migrations,
- sync jobs,
- ingestion backfills,
- data repair scripts,
- destructive SQL,
- bulk mutations,
- privileged maintenance,
- or equivalent operational work

without explicit owner instruction.

Code may be written, reviewed, tested safely, and prepared for these operations without executing them against production.

If production execution is explicitly requested, clearly distinguish:

- the code change,
- the deployment,
- and the production operation.

## 20. Verification

Backend work is not complete because:

- TypeScript passes,
- the application builds,
- or a function returns once.

Verify the behaviour appropriate to the change.

Depending on scope, verification should cover the relevant chain:

user action → server boundary → validation → authorisation → database/external operation → resulting state → response → rendered result

Examples:

- a query change should be tested against representative data,
- a migration should be applied safely in the appropriate non-production environment and inspected,
- an API change should verify request, validation, data operation, and response,
- an auth change should test both permitted and denied behaviour,
- an ingestion change should verify deduplication and resulting records,
- a scheduled job should verify its logic and resulting state without unauthorised production execution.

Do not repeatedly retry the same failing approach.

After a small number of unsuccessful attempts, inspect:

- logs,
- current documentation,
- schema,
- policies,
- environment state,
- and runtime behaviour

before continuing.

## 21. Backend production-readiness sweep

Before backend work is considered complete, review the relevant items:

- security implications,
- RLS implications,
- authentication vs authorisation,
- migration safety,
- data preservation,
- constraints,
- indexing,
- query bounds,
- input validation,
- secret handling,
- error handling,
- retry behaviour,
- idempotency,
- duplicate prevention,
- transaction boundaries,
- observability,
- environment differences,
- edge cases,
- and end-to-end verification.

Do not perform unrelated architectural refactoring during this sweep.

Fix concrete risks associated with the requested change.

## 22. Backend completion standard

Backend work is complete when:

- the requested behaviour works,
- the Issue acceptance criteria are satisfied,
- persistent changes are reproducible,
- existing security boundaries remain intact,
- relevant failure cases are handled,
- production execution has not occurred without authorisation,
- and the changed behaviour has been meaningfully verified.

Optimise for correctness, simplicity, and operability over theoretical sophistication.
