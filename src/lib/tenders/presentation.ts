import { differenceInSastCalendarDays, SAST_TIME_ZONE } from "../sast-date"
import { parseTenderTimestamp } from "./calendar"

const dayFormatter = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: SAST_TIME_ZONE,
})

export function normalizeTenderTitle(value?: string | null) {
  if (!value) return null

  const title = value.replace(/\s+/g, " ").trim()
  const letters = title.match(/\p{L}/gu) || []
  if (!letters.length) return title

  const uppercaseLetters = letters.filter(
    (letter) => letter === letter.toLocaleUpperCase("en-ZA")
  )
  const isMostlyUppercase = uppercaseLetters.length / letters.length > 0.75

  if (!isMostlyUppercase) return title

  const sentenceCase = title
    .toLocaleLowerCase("en-ZA")
    .replace(/(^|[.!?]\s+)(\p{L})/gu, (_, prefix: string, letter: string) => {
      return `${prefix}${letter.toLocaleUpperCase("en-ZA")}`
    })

  return sentenceCase.replace(
    /\b(rfq|rfp|rfi|eoi|ict|ot|ntcsa|sita|scm|cidb|vat|bbbee|b-bbee|csd|ppe|hvac|ups|cctv|nersa|soc|ltd|pty)\b/giu,
    (match) => match.toLocaleUpperCase("en-ZA")
  )
}

export function formatClosingUrgency(value?: string | null, now = Date.now()) {
  if (!value) {
    return {
      className: "text-muted-foreground",
      label: "Closing date TBC",
    }
  }

  const date = parseTenderTimestamp(value)
  if (!date) {
    return {
      className: "text-muted-foreground",
      label: "Closing date TBC",
    }
  }

  const diffMs = date.getTime() - now
  if (diffMs <= 0) {
    return {
      className: "text-muted-foreground",
      label: "Closed",
    }
  }

  const dayMs = 24 * 60 * 60 * 1_000
  const hourMs = 60 * 60 * 1_000
  const minuteMs = 60 * 1_000

  if (diffMs < hourMs) {
    const minutesLeft = Math.max(1, Math.ceil(diffMs / minuteMs))
    return {
      className: "text-primary",
      label: `Closing in ${minutesLeft} ${
        minutesLeft === 1 ? "minute" : "minutes"
      }`,
    }
  }

  if (diffMs < dayMs) {
    const hoursLeft = Math.max(1, Math.ceil(diffMs / hourMs))
    return {
      className: "text-primary",
      label: `Closing in ${hoursLeft} ${hoursLeft === 1 ? "hour" : "hours"}`,
    }
  }

  const calendarDaysLeft = differenceInSastCalendarDays(date, now)

  if (calendarDaysLeft === 1) {
    return {
      className: "text-primary",
      label: "Closes tomorrow",
    }
  }

  if (
    calendarDaysLeft !== null &&
    calendarDaysLeft >= 2 &&
    calendarDaysLeft <= 5
  ) {
    return {
      className: "text-primary",
      label: `Closes in ${calendarDaysLeft} days`,
    }
  }

  return {
    className: "text-muted-foreground",
    label: `Closes ${dayFormatter.format(date)}`,
  }
}
