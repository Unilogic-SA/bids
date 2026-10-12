import { z } from "zod"
import { BID_OUTCOMES, BID_STAGES, type WorkspaceFilters } from "./types"
export const ocidSchema = z
  .string()
  .min(1)
  .max(250)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid tender reference")
export const checklistSchema = z
  .array(
    z
      .object({
        id: z.uuid(),
        label: z.string().trim().min(1).max(200),
        completed: z.boolean(),
        kind: z.literal("compulsory_briefing").optional()
      })
      .strict()
  )
  .max(50)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "Checklist items must be unique"
  )
const dateSchema = z.iso.datetime({ offset: true }).nullable()
export const patchSchema = z
  .object({
    stage: z.enum(BID_STAGES).optional(),
    outcome: z.enum(BID_OUTCOMES).nullable().optional(),
    notes: z.string().max(10000).optional(),
    next_action: z.string().trim().max(200).nullable().optional(),
    next_action_due_at: dateSchema.optional(),
    checklist: checklistSchema.optional(),
    submitted_at: dateSchema.optional(),
    submission_reference: z.string().trim().max(500).nullable().optional(),
    archive: z.boolean().optional(),
    acknowledge_deadline: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No changes supplied")
export const mutationSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().min(1),
    patch: patchSchema
  })
  .strict()
export const importSchema = z
  .array(ocidSchema)
  .min(1)
  .max(50)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Duplicate tender references"
  )
export function parseWorkspaceFilters(
  params: URLSearchParams
): WorkspaceFilters {
  const stage = params.get("stage")
  const offsets: WorkspaceFilters["offsets"] = {}
  for (const value of BID_STAGES)
    offsets[value] = boundedInt(params.get(`offset_${value}`), 0, 100000)
  return {
    q: (params.get("q") || "").trim().slice(0, 200),
    state:
      params.get("state") === "completed"
        ? "completed"
        : params.get("state") === "archived"
          ? "archived"
          : "active",
    stage: BID_STAGES.includes(stage as (typeof BID_STAGES)[number])
      ? (stage as (typeof BID_STAGES)[number])
      : "all",
    week: params.get("week") === "1",
    view: params.get("view") === "board" ? "board" : "list",
    page: boundedInt(params.get("page"), 1, 2000),
    offsets
  }
}
function boundedInt(value: string | null, fallback: number, max: number) {
  const n = Number(value)
  return value && Number.isInteger(n) && n >= fallback
    ? Math.min(n, max)
    : fallback
}
