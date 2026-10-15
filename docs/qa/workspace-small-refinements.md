# Workspace small refinements

Follow-up to merged PR #73, requested by the owner on 15 October 2026.

## Changes

- Selection uses the checkbox alone; Workspace rows have no selected/hover fill.
- Remove the active/completed/archived selector. Retain stage, week and search;
  existing record-state URLs remain supported without adding replacement controls.
- Mobile always requests/renders the paginated list, including saved board
  preferences and explicit board URLs. Desktop retains both views and drag/drop.
- Use **Checklist**, remove its helper copy and Prepare bid button, keep Add item.
  Existing saved items and backend stage/template rules are unchanged.
- Autosave checklist additions, labels, completion and removal. Stage changes
  already persist immediately; they now flush any queued checklist edit first.
- Close, Escape and Open tender flush pending edits automatically. Remove the
  manual Save button and the Keep editing / Discard draft confirmation.
- Failed/invalid/conflicting saves keep the editor and draft available with inline
  recovery. Conflicts show the latest saved items before explicit Retry save.
  Browser refresh/unload protection remains while a write is unsaved.
- Correct active navigation styling. Reduce list padding by 2px per side; slightly
  tighten Kanban padding/gaps and hide buyer on cards, retaining it in list/details.

The small non-UI autosave controller is justified by serialized versioned writes:
it coalesces edits for 500ms, drains newer edits after an in-flight request,
advances versions safely and cancels queued writes when the editor unmounts.
Ordinary typing stays enabled during checklist saves. Successful autosaves use
quiet inline feedback rather than a toast on each edit.

## Verification

- **184 tests passed** (175 existing + 9 focused autosave/mobile-query tests).
- Lint, TypeScript and production webpack build passed without new warnings.
- Impeccable Workspace detection: exit 0, zero findings. Source whitespace check passed.
- **14 rendered Chromium scenarios passed**, with no JavaScript page errors:
  navigation/filter controls; checkbox-only selection; minimal checklist/add;
  immediate close; queued edits during a 900ms save; stage version ordering;
  failed-save retention/retry; conflict review/retry; blank-name recovery and
  toggle/delete; desktop buyer disclosure; desktop keyboard DnD; mobile list
  preference/URL override; mobile Drawer autosave/close; 320/390/640px overflow.
- Browser fixtures intercept account/read/action responses only in the test
  browser, use synthetic records and enforce request versions. App auth, schemas,
  RLS and live data are unchanged. Live authenticated backend writes were not tested.
- External Umami requests fail in this environment (pre-existing), separately from
  application errors. No failing repository check was found.

## Captures

Synthetic data, desktop 1440×1000 and mobile 390×844:

[Desktop list](workspace-small-refinements/desktop-list.png) ·
[Desktop modal](workspace-small-refinements/desktop-modal.png) ·
[Mobile list](workspace-small-refinements/mobile-list.png) ·
[Mobile Drawer](workspace-small-refinements/mobile-drawer.png)

No dependencies, migrations, authentication or unrelated page changes. The shared
header change is limited to the requested active navigation colouring.
