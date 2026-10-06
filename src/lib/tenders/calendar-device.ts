export type CalendarDevice = "ios" | "android" | "mac" | "windows" | "other"

// This is an ordering hint, never a restriction on the user's calendar choice.
// iPadOS can advertise a desktop Mac user agent, so include its touch signal.
export function detectCalendarDevice({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
}: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
}): CalendarDevice {
  if (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Mac/i.test(platform || userAgent) && maxTouchPoints > 1)
  )
    return "ios"
  if (/Android/i.test(userAgent)) return "android"
  if (/Mac/i.test(platform || userAgent)) return "mac"
  if (/Win/i.test(platform || userAgent)) return "windows"
  return "other"
}

export function getCalendarChoices(device: CalendarDevice) {
  if (device === "ios" || device === "mac")
    return ["file", "google", "outlook", "microsoft365"] as const
  if (device === "windows")
    return ["outlook", "microsoft365", "google", "file"] as const
  return ["google", "outlook", "microsoft365", "file"] as const
}
