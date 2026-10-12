# 002 — Workspace UI polish
Planned at: 660cdbe035e041a5c57350479e206d88b8abb858
Issue: https://github.com/Unilogic-SA/bids/issues/61
Status: Implemented for review; latest Preview browser verification pending
Dependency: #60 merged in main.

## Goal and evidence
Owner requests small UI refinements to task detail sheet, Kanban and coloured single selects. Live Google OAuth succeeded at www.openbid.co.za and signed-in workspace has three existing records. Desktop screenshot shows sheet only ~384px wide, making buyer/fields/checklist crowded. BidPanel supplies sm:max-w-xl but SheetContent's data-[side=right]:sm:max-w-sm is more specific. Fix variant specificity locally, never global Sheet primitive. Existing checklist has seven always-bordered input rows and permanently visible save controls. Board uses bordered outer columns plus dense cards with repeated neutral stage controls. Preserve app's restrained purple brand and shadcn primitives.

## Recon and scope
Repository Unilogic-SA/bids, Next16 React19 TypeScript Tailwind/shadcn/radix-nova Tabler npm. Read AGENTS.md, docs/ai/frontend.md and docs/ai/workflow.md.
Allowed source files: src/components/workspace/bid-panel.tsx, bid-stage-menu.tsx, workspace-board.tsx, workspace-client.tsx; optional one workspace-local stage presentation TS/TSX module; optional existing workspace-list.tsx for directly related duplicate metadata only. plans/002-workspace-ui-polish.md can be committed as task record.
Out of scope: auth/providers/API/server actions/database/migrations/core state and validation, global UI primitives/theme, dependencies, tender data, unrelated navigation.
Current state: SheetContent className="w-full sm:max-w-xl"; body flex-1 overflow-y-auto px-4; Preparation space-y-5; checklist Input className="h-8"; save section controls shown disabled when clean. Board Column w-64 border bg-muted/30; BidCard stage outline button, buyer, deadline, fraction. BidStageMenu is outline Button with text+Chevron; workspace-client filter and mobile Board Select plain. Keep callback contracts and data versions.

## Steps
1. Fix sheet desktop width using matching data-[side=right] variants to use available width bounded max-w-xl; use clear fixed header with title/buyer/reference, border separator and balanced padding. Avoid duplicate reference when title equals ref. Keep responsive Drawer h90dvh, accessible title/description, close controls, scroll body and dirty navigation protection.
2. Polish Preparation layout without changing save/state logic: metadata as compact rows/grid, section boundaries and clearer labels; unobtrusive checklist Input border/background until focus/hover using shadcn Input, completed text muted/line-through with edit focus readability; remove buttons still discoverable keyboard/mobile. Compact section save controls only when dirty/pending/failure/conflict (or use other equally restrained approach without losing necessary controls); preserve all error and conflict details. Keep explicit saves per section. Do not combine save operations or autosave. Put rare archive/delete into an existing DropdownMenu if useful, retain confirmation callbacks and unsaved-draft behavior.
3. One small shared stage/outcome style mapping using existing semantic colour tokens (primary/purple, muted, critical) and/or restrained existing Tailwind semantic hues when necessary to clearly communicate state. No arbitrary hex colours, theme changes or dependencies. Apply consistently to BidStageMenu trigger/menu dots, filter Select values/items and mobile Board stage selector, board headings. Every stage retains text; colour not sole signal; keyboard/focus/disabled behavior stays.
4. Refine board hierarchy: quieter column containers, compact header with stage marker/count, cleaner cards with stable spacing, buyer long-text handling, labelled closing time/calendar icon, meaningful checklist progress only when initialized/nonempty; preserve stage menu alternative and dedicated visible draggable handle with keyboard listeners. Avoid clipped essential full title; no nested clickable cards interfering controls; visible drop targets/hover/focus. Keep mobile one-stage view and pagination.
5. Run npm ci, npm test (149 baseline), npm run lint, npm run typecheck, npm run build and git diff --check. No cosmetic snapshot tests. New tests only if behavior must change; avoid such changes.
6. Reviewer handles live/Preview browser QA and GitHub publication. Commit source in isolated worktree codex/61-workspace-ui-polish, don't push or merge. Reply report with files, commit SHA, checks and actual limitations. Do not touch plans/README.md.

## Browser QA (reviewer)
Compare signed-in List/Board, stage selection menu and filter options, sheet opening/closing, dirty draft Keep editing/Discard, checklist/notes editing without saves on existing production records, submit/backward dialogs cancelled (no actual stage change), search/empty tabs/refresh. Verify latest Preview Google OAuth if possible; inspect current deployed commit. Browser viewport is desktop; mobile source checks unless actual resize supported. Do not claim mobile runtime coverage absent tools.
STOP if achieving UI requires schema/auth/state changes, unavailable primitives/new libraries, or destructive actions. Report environmental failures, do not bypass auth. Preserve confidential content from issues/PRs.


## Implementation result

- Local matching Sheet variants restore the intended desktop width; header, metadata and preparation sections are refined.
- Shared stage/outcome colours accompany labels in menus, filters, board headings and the mobile selector.
- Checklist rows stay editable with quieter borders and visible remove controls. Explicit save controls appear for drafts or failed/conflicted saves.
- Board columns fit ordinary desktop widths, retain narrower overflow and show labelled deadlines/checklist counts without empty progress noise.
- Directly related filter correction: Clear filters explicitly uses `type="button"`, preventing the surrounding form from submitting and reinstating stale filters.
- Validation: `npm ci`, all 149 tests, lint, typecheck, production build and `git diff --check` passed.
- Scope remained within the four listed compositions and one presentation module. Save/state/version/conflict callbacks are unchanged. Reviewer owns live/Preview browser verification and publication; no production mutations were performed by the executor.
