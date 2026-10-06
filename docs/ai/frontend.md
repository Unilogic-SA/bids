# Frontend Engineering

This document defines how frontend, UI, and UX work should be implemented in OpenBids.

shadcn/ui is the authoritative UI system for this project.

The objective is not to create a second design system. The objective is to build product-specific OpenBids interfaces by composing shadcn primitives and then refining those interfaces until they feel complete, restrained, and production-ready.

## 1. UI system

Use shadcn/ui as the primary and authoritative UI foundation.

For frontend work:

1. Inspect the existing implementation and nearby project components first.
2. Reuse an existing OpenBids composition when one already satisfies the need.
3. Reuse an installed shadcn component when appropriate.
4. Use the installed shadcn skill for current shadcn implementation guidance.
5. Use the shadcn MCP or registry tooling when a component or current pattern needs to be searched, inspected, or added.
6. If no single shadcn component provides the required product behaviour, compose the interface from shadcn primitives.
7. Preserve existing project tokens, variants, and conventions.
8. Verify the resulting behaviour at the relevant viewport sizes.

Do not introduce another UI component framework.

Do not create a parallel design system.

## 2. No custom UI primitives

Do not create custom replacements for UI primitives already provided by shadcn.

Examples:

- use `Button`; do not create a new button primitive,
- use `Dialog`, `AlertDialog`, `Sheet`, or `Drawer`; do not create a custom modal system,
- use `Select`, `DropdownMenu`, `Popover`, `Command`, and related shadcn patterns for selection interfaces,
- use shadcn form controls rather than custom input primitives,
- use `Tooltip` for contextual assistance,
- use `Skeleton` for loading placeholders,
- use the project's established toast / Sonner pattern for transient feedback,
- use shadcn `Badge`, `Separator`, `Table`, `Tabs`, `Accordion`, `Calendar`, `Popover`, `Progress`, `Alert`, and similar primitives when those interaction patterns are required.

Normal structural HTML such as `div`, `section`, `main`, `header`, flex, and grid wrappers is expected and allowed.

The restriction is against recreating UI primitives or interaction systems already owned by shadcn.

There is currently no custom-primitive fallback.

If a requested interaction appears to require a new primitive, first determine whether it can be expressed by composing existing shadcn components.

## 3. Product-specific components

OpenBids-specific components are encouraged when they represent reusable product concepts.

Examples may include:

- `TenderCard`
- `TenderFilters`
- `TenderDeadline`
- `TenderDocuments`
- `BuyerSummary`
- `SaveTenderButton`
- `WorkspaceStatus`
- `TenderSourceLink`

These are product compositions, not new UI primitives.

Build them from:

- existing OpenBids components,
- shadcn components,
- semantic HTML,
- and existing project design tokens.

Before creating a new product component, check whether an equivalent composition already exists.

Prefer extending a coherent existing product composition over creating a near-duplicate.

## 4. Component decision hierarchy

Use this order when implementing interface requirements:

1. Existing OpenBids composition
2. Existing installed shadcn component
3. Appropriate shadcn component or block available through the current registry/tooling
4. Composition of shadcn primitives

Do not skip directly to bespoke UI.

Do not install a second component library to solve a component need.

## 5. Preserve the design system

Use the project's existing:

- CSS variables,
- semantic colour tokens,
- typography,
- spacing scale,
- radius conventions,
- icon library,
- component variants,
- responsive conventions,
- and interaction patterns.

Avoid arbitrary one-off values when an existing token or variant can achieve the same result.

Do not create a parallel styling system.

Do not add decorative visual language that conflicts with the rest of the product.

When modifying a component, preserve compatibility with the existing design system unless the Issue explicitly requires changing that system.

## 6. Product character

OpenBids is a professional procurement application.

Optimise for:

- clarity,
- speed,
- scanning,
- trust,
- predictable behaviour,
- low cognitive load,
- strong information hierarchy,
- restrained visual design,
- and useful information density.

The application should feel closer to mature financial, procurement, and enterprise software than to a consumer application or marketing website.

Colour should primarily communicate:

- meaning,
- state,
- status,
- priority,
- or urgency.

Do not use colour primarily as decoration.

Motion should be subtle, purposeful, and non-blocking.

Prefer progressive disclosure over displaying every available control simultaneously.

Prefer one clear primary action over several competing primary actions.

## 7. Functional implementation is the first pass

A feature being functional does not automatically mean the UI work is finished.

For meaningful frontend work, perform a final refinement pass using the following principles:

1. Distill
2. Layout
3. Typeset
4. Clarify
5. Harden
6. Polish

These are quality principles, not separate design systems or required external skills.

Use them to refine the existing implementation rather than redesigning it without cause.

---

# UI Quality Standard

## 8. Distill

Reduce the interface to what is necessary for the user's task.

Look for opportunities to:

- remove duplicated information,
- remove unnecessary labels,
- remove unnecessary headings,
- remove redundant helper text,
- reduce competing actions,
- reduce unnecessary containers,
- reduce nested cards,
- simplify unnecessarily complex layouts,
- remove steps that provide no meaningful value,
- use sensible defaults,
- and make the primary action or next step obvious.

Prefer hierarchy, spacing, alignment, and typography over additional boxes, borders, and decoration.

Do not remove information that materially helps a user understand or evaluate a procurement opportunity.

Avoid "carditis": not every logical group requires its own card.

Where a simple section, separator, typographic hierarchy, or spacing relationship is sufficient, prefer that over another container.

## 9. Layout

Refine spacing, alignment, density, grouping, and visual hierarchy.

Ensure:

- related information is visually grouped,
- unrelated groups have appropriate separation,
- spacing follows a consistent scale,
- alignment is intentional,
- important content receives more visual weight than metadata,
- dense information remains scannable,
- desktop and mobile layouts both feel intentional,
- actions remain discoverable at appropriate breakpoints,
- and layouts do not create unnecessary vertical scrolling.

OpenBids should feel compact and efficient without feeling cramped.

Avoid:

- excessive whitespace,
- excessive card usage,
- decorative layout complexity,
- arbitrary widths,
- inconsistent gaps,
- and desktop-only compositions that collapse poorly on smaller screens.

Use responsive behaviour deliberately rather than merely allowing elements to wrap accidentally.

## 10. Typeset

Use typography to establish hierarchy before adding more visual elements.

Review:

- heading hierarchy,
- body text readability,
- metadata sizing,
- label consistency,
- line length,
- wrapping,
- truncation,
- numerical readability,
- date readability,
- long tender titles,
- long buyer names,
- and long descriptions.

Use consistent typography for elements that serve the same role.

Do not create hierarchy by making everything bold.

Use muted styling for genuinely secondary information, not for information that users need to scan quickly.

Ensure truncation does not hide essential meaning without an appropriate way to access the complete value.

## 11. Clarify

Interface language should make state and available actions immediately understandable.

Review:

- button labels,
- form labels,
- tooltips,
- empty-state copy,
- confirmation messages,
- error messages,
- status terminology,
- destructive actions,
- success feedback,
- loading labels,
- and helper text.

Prefer concise, plain language.

Use the same terminology for the same concept throughout the application.

Avoid internal implementation terminology in the UI.

Use tooltips when an unfamiliar icon requires explanation, not as a substitute for clear labels everywhere.

For errors, explain what happened and what the user can do next when useful.

Do not present technical implementation details to end users unless they are genuinely actionable.

## 12. Harden

Every meaningful interface should handle realistic production states.

Consider:

- loading,
- empty,
- error,
- success,
- disabled,
- partial data,
- missing optional data,
- zero results,
- one result,
- large result sets,
- long text,
- slow requests,
- failed requests,
- repeated clicks,
- unavailable documents,
- expired tenders,
- imminent deadlines,
- narrow mobile widths,
- and large desktop widths.

Interactive elements should have appropriate states where relevant:

- default,
- hover,
- focus,
- active,
- disabled,
- loading,
- error,
- and success.

Avoid layout shift where practical.

Prevent accidental repeated actions where a mutation is still in progress.

Do not design only for the ideal dataset.

Do not assume all tender fields are present or well-formed.

## 13. Polish

Before considering meaningful UI work complete, perform one restrained quality sweep.

Look specifically for:

- inconsistent spacing,
- slightly incorrect alignment,
- inconsistent icon sizing,
- inconsistent button treatment,
- unnecessary borders,
- duplicated controls,
- missing feedback,
- awkward responsive behaviour,
- missing tooltips where an unfamiliar icon needs explanation,
- inconsistent terminology,
- poor text truncation,
- unnecessary layout shift,
- weak loading states,
- weak empty states,
- missing or inconsistent focus states,
- visual noise,
- and interaction inconsistencies.

Polish means refinement, not redesign.

Do not during a polish pass:

- introduce a new visual language,
- replace shadcn primitives,
- introduce custom UI primitives,
- significantly increase component complexity,
- add decorative effects merely to make the page feel more designed,
- or change established product patterns without a concrete reason.

Small improvements should compound into a product that feels considered and complete.

## 14. Accessibility and interaction

Use accessible shadcn primitives as intended.

Preserve:

- keyboard accessibility,
- focus visibility,
- appropriate semantic structure,
- labels for form controls,
- accessible names for icon-only actions,
- and sensible tab order.

Do not remove accessibility behaviour for visual convenience.

Do not make important functionality hover-only.

Ensure icon-only buttons have an accessible label and, where useful, a visible tooltip.

Use destructive variants and confirmations consistently for destructive actions.

## 15. Data-heavy interface behaviour

OpenBids frequently presents procurement records, metadata, deadlines, documents, buyers, and search/filter controls.

Optimise data-heavy interfaces for:

- fast scanning,
- predictable placement,
- clear status,
- compact metadata,
- stable layout,
- and low-friction navigation.

For tender listings and similar collections:

- preserve useful context when navigating into and back from details,
- keep filters understandable,
- surface urgency without overwhelming the interface,
- and avoid showing the same metadata multiple times without reason.

For long content:

- prioritise essential procurement information,
- use progressive disclosure where appropriate,
- and avoid pages that scroll for excessive lengths merely because all available fields exist.

## 16. Loading, empty, error, and feedback states

Use shadcn-supported patterns for state communication.

Loading states should approximate the final layout when practical.

Empty states should explain:

- what is empty,
- why it may be empty when relevant,
- and what useful action the user can take next.

Errors should distinguish between:

- recoverable user-level failures,
- temporary service failures,
- and states where no action is required from the user.

Mutation feedback should be timely and unambiguous.

Do not show success before the underlying operation has actually succeeded.

## 17. Frontend verification

For meaningful UI changes:

1. Verify the intended interaction works.
2. Verify relevant loading, empty, error, and disabled states.
3. Verify desktop behaviour.
4. Verify mobile behaviour.
5. Check for console errors or obvious client-side warnings where practical.
6. Confirm the implementation still uses established shadcn/project patterns.
7. Perform one final restrained visual pass.

Do not repeatedly redesign or polish the same interface.

Perform one comprehensive inspection, fix identified issues together, then perform at most one confirmation pass unless a functional problem remains.

If Vercel Preview is used for owner-facing verification, only describe the latest Preview as verified if the latest deployed commit was actually tested.

## 18. Frontend completion standard

Frontend work is complete when:

- the requested behaviour works,
- the acceptance criteria are satisfied,
- shadcn remains the underlying UI system,
- no unnecessary custom primitive was introduced,
- relevant edge states are handled,
- the interface is responsive,
- accessibility basics are preserved,
- and the final interface feels consistent with the rest of OpenBids.

Do not optimise for novelty.

Optimise for coherence, clarity, and completeness.
