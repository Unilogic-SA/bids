# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Supplier bid teams finding public tenders and preparing their organisation’s
responses (confirmed by the owner during Workspace refinement, 15 October 2026).

## Product Purpose

OpenBids helps users discover South African public tenders, save opportunities,
prepare responses and track bids through their lifecycle. Workspace success means
finding the relevant bid, seeing its deadline and preparation state, and safely
updating the next step.

## Operating Context

Tender titles, buyer names, references, official deadlines and compulsory briefings
are procurement context. Dates are presented in South African Standard Time.
Workspace supports list and Kanban views, stage changes, preparation checklists,
submission records, outcomes and archived records. Submission happens outside
OpenBids; recording submission must not imply that OpenBids delivered a bid.

## Capabilities and Constraints

Preserve search, all filters, bulk selection/editing, drag-and-drop, checklist
editing/saving, error recovery and unsaved-change protection. Desktop preparation
uses shadcn Dialog; mobile uses Drawer. No note-taking functionality. Checklist
prompts do not replace the tender’s full requirements.

The existing Next.js/React/TypeScript application uses shadcn/ui and Supabase.
UI refinement must not change schemas, RLS or authentication or add product
features. No pricing, adoption or performance claims are established here.

## Brand Commitments

Preserve OpenBids’ name, branding, typography, colours, tokens and shadcn conventions.
The owner requests restraint and precision inspired by Linear, Vercel and Notion,
without copying their branding. Voice is concise, practical and professional.

## Evidence on Hand

Repository evidence: README.md, AGENTS.md, docs/ai/frontend.md,
src/app/globals.css, src/app/layout.tsx and src/components/workspace/.
Product capabilities above are grounded in the existing implementation and the
owner’s task. QA captures use explicitly synthetic procurement data.

## Product Principles

- Make deadlines and preparation state easy to scan.
- Preserve user work and explain recovery when an update fails.
- Reduce presentation complexity without removing capabilities.
- Distinguish official tender information from user-recorded preparation.

## Accessibility & Inclusion

Preserve keyboard operation, labelled controls, visible focus, responsive layouts
and explicit state/error feedback. Mobile web remains the web platform.
