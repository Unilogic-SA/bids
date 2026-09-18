export const SAST_TIME_ZONE = "Africa/Johannesburg"

const sastDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function getSastDateKey(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = sastDateKeyFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return year && month && day ? `${year}-${month}-${day}` : null
}

export function isSameSastDay(
  left: Date | string | number,
  right: Date | string | number
) {
  const leftKey = getSastDateKey(left)
  return leftKey !== null && leftKey === getSastDateKey(right)
}

export function differenceInSastCalendarDays(
  later: Date | string | number,
  earlier: Date | string | number
) {
  const laterKey = getSastDateKey(later)
  const earlierKey = getSastDateKey(earlier)
  if (!laterKey || !earlierKey) return null

  return (Date.parse(`${laterKey}T00:00:00Z`) - Date.parse(`${earlierKey}T00:00:00Z`)) /
    86_400_000
}
