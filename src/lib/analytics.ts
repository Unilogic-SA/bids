import { analyticsAllowed, currentCampaign, isMeasurementPage, trackGoogleEvent } from "@/lib/google-analytics"

export type UmamiEventData = Record<
  string,
  string | number | boolean | null | undefined
>

type UmamiTracker = {
  track: (eventName: string, data?: Record<string, string | number | boolean>) => void
}

declare global {
  interface Window {
    umami?: UmamiTracker
  }
}

export function trackUmamiEvent(
  eventName: string,
  eventData: UmamiEventData = {}
) {
  if (typeof window === "undefined") return

  const data = Object.fromEntries(
    Object.entries(eventData).filter(([, value]) => value !== undefined && value !== null)
  ) as Record<string, string | number | boolean>

  const campaign = analyticsAllowed() && isMeasurementPage(window.location.pathname) ? currentCampaign() : {}
  window.umami?.track(eventName, { ...data, ...campaign })
  trackGoogleEvent(eventName, data)
}
