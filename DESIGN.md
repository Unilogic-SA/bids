---
name: OpenBids
description: Restrained South African procurement productivity interface
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.491 0.27 292.581)"
  chart-1: "oklch(0.811 0.111 293.571)"
  primary-foreground: "oklch(0.969 0.016 293.756)"
  secondary: "oklch(0.967 0.001 286.375)"
  secondary-foreground: "oklch(0.21 0.006 285.885)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  card: "oklch(1 0 0)"
  popover: "oklch(1 0 0)"
  dark-background: "oklch(0.145 0 0)"
  dark-foreground: "oklch(0.985 0 0)"
  dark-primary: "oklch(0.432 0.232 292.759)"
  dark-primary-foreground: "oklch(0.969 0.016 293.756)"
  dark-secondary: "oklch(0.274 0.006 286.033)"
  dark-secondary-foreground: "oklch(0.985 0 0)"
  dark-muted: "oklch(0.269 0 0)"
  dark-muted-foreground: "oklch(0.708 0 0)"
  dark-border: "oklch(1 0 0 / 10%)"
  dark-input: "oklch(1 0 0 / 15%)"
  dark-ring: "oklch(0.556 0 0)"
  dark-destructive: "oklch(0.704 0.191 22.216)"
  dark-card: "oklch(0.205 0 0)"
  dark-popover: "oklch(0.205 0 0)"
typography:
  heading:
    fontFamily: Figtree
  body:
    fontFamily: Inter
  mono:
    fontFamily: Geist Mono
rounded:
  sm: 0.27rem
  md: 0.36rem
  lg: 0.45rem
spacing:
  1: 0.25rem
  2: 0.5rem
  3: 0.75rem
  4: 1rem
  5: 1.25rem
  6: 1.5rem
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: 2rem
  input:
    rounded: "{rounded.lg}"
    height: 2rem
---

# Design System: OpenBids

## Overview

OpenBids is a compact, professional procurement interface. Its existing neutral
surfaces, purple primary colour and precise typography support scanning and
preparation. Refinement preserves this identity; maturity comes from hierarchy,
consistent spacing and dependable feedback.

This record describes incumbent code, not a rebrand. The owner's direction is
minimal, cohesive and highly functional. Branding, fonts, tokens and shadcn/ui
remain authoritative even where generic Impeccable suggestions differ.

## Colors

Normative sources: `src/app/globals.css` and
`src/components/workspace/stage-presentation.tsx`. The frontmatter records the
existing CSS values; edit the source first rather than creating competing tokens.

Purple primary indicates the main action and preparation state. Neutral surfaces,
borders and muted text carry secondary information. Destructive/critical colours
communicate urgency or irreversible actions. Existing stage semantics remain:
saved neutral, reviewing amber, preparing purple, ready sky, submitted/won emerald,
unsuccessful destructive, withdrawn/not bidding neutral. Labels accompany colour.
Light and dark semantic values above are extracted without changing them.

## Typography

`src/app/layout.tsx` loads Inter (`--font-sans`), Figtree
(`--font-heading`) and Geist Mono (`--font-geist-mono`) via Next fonts.
Preserve these families. Existing Workspace uses small, medium-weight tender
headings, 14px body/control text, 12px secondary metadata, and tabular numerals
for dates/counts. shadcn Dialog titles carry the heading font convention.
Use weight and position before colour to establish hierarchy. Long procurement
names wrap; truncation must retain an accessible full value or detail view.

## Layout

Tailwind 4 spacing follows quarter-rem steps. The Workspace container is
`max-w-7xl`, with 16px mobile and 24px desktop horizontal padding. Related controls
use 8–12px gaps; content sections use 16–20px separation. shadcn's radix-nova
controls are compact (32px default, 28px small); Workspace touch controls may be
larger. Existing mobile detection changes below 768px; `sm` begins at 640px.

List rows use a responsive grid below the desktop table. Kanban columns scroll
horizontally on desktop and expose a stage selector on mobile. Preparation uses
a centred desktop Dialog and a mobile bottom Drawer; long content scrolls within
90dvh. Keep close controls, focus restoration and dirty-draft protection.

## Elevation & Depth

Use borders, spacing and quiet surface differences for ordinary content. Kanban
cards are flat (`shadow-none`); overlays and the floating bulk toolbar use the
existing shadcn shadow scale for genuine elevation. No gradients, exaggerated
shadows or decorative effects are needed.

## Shapes

`--radius: 0.45rem` is the source. Small and medium radii derive at 0.6 and 0.8
multiples; large uses the base. Use installed shadcn variants, rounded corners
and one-pixel semantic borders. Do not introduce a parallel shape system.

## Components

The installed system is shadcn/ui `radix-nova`, Tailwind CSS variables, Tabler
icons, and Radix/Vaul interaction primitives (`components.json`). Reuse
`src/components/ui/`; product components compose these primitives.

Buttons use primary, outline, secondary, ghost and destructive variants. Inputs
and Selects share semantic borders, disabled states and focus-visible ring/border
feedback. Icon-only actions need accessible names and contextual tooltips.
Stage dots supplement explicit labels. Tooltips enhance desktop detail without
blocking touch actions. Sonner provides confirmed mutation feedback.

Alerts distinguish urgent/deadline changes from informational source state.
Checklists retain visible progress, explicit dirty/save/failure/conflict feedback,
inline editing and retry. Skeleton, Empty and Alert cover collection states.

## Do's and Don'ts

- Do preserve existing semantic tokens, Inter/Figtree/Geist Mono and Tabler icons.
- Do prioritise tender title, buyer, closing time and preparation progress.
- Do preserve keyboard, touch, focus, confirmation and error-recovery behaviour.
- Do use whitespace and hierarchy before adding containers.
- Don't replace shadcn primitives or introduce another UI framework.
- Don't add decorative motion, gradients, exaggerated shadows or note-taking.
- Don't remove important procurement information simply to make a view sparse.
