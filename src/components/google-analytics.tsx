"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"
import {
  analyticsAllowed, analyticsChoice, currentCampaign, googleMeasurementId, isMeasurementPage,
  nextMeasurementContext, setAnalyticsChoice, subscribeAnalyticsChoice, trackGoogleEvent,
} from "@/lib/google-analytics"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const serverChoice = () => null
const serverAllowed = () => false

export function GoogleAnalytics() {
  const pathname = usePathname()
  const id = googleMeasurementId(process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID)
  const [ready, setReady] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const choice = useSyncExternalStore(subscribeAnalyticsChoice, analyticsChoice, serverChoice)
  const lastMeasuredPath = useRef<string | null>(null)
  const publicPage = isMeasurementPage(pathname)
  const allowed = useSyncExternalStore(subscribeAnalyticsChoice, analyticsAllowed, serverAllowed)

  useEffect(() => {
    if (!id) return
    // Google respects this flag even after its script has loaded on a previous page.
    Object.assign(window, { [`ga-disable-${id}`]: !publicPage || !allowed })
    if (!publicPage || !allowed) {
      window.openbidsMeasurementContext = undefined
      lastMeasuredPath.current = null
      return
    }
    currentCampaign()
    if (!ready || !window.gtag) return
    const context = nextMeasurementContext(new URL(window.location.href), window.openbidsMeasurementContext, document.referrer)
    window.openbidsMeasurementContext = context
    window.gtag("config", id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: context.location,
      page_referrer: context.referrer,
      page_title: pathname === "/" ? "OpenBids tender search" : "OpenBids tender detail",
    })
    const sendPageView = () => window.gtag?.("event", "page_view", {
      send_to: id,
      page_location: context.location,
      page_referrer: context.referrer,
      page_title: window.location.pathname === "/" ? "OpenBids tender search" : "OpenBids tender detail",
    })
    if (lastMeasuredPath.current !== pathname) {
      sendPageView()
      lastMeasuredPath.current = pathname
    }
    // Mirror existing declarative Umami events without sending URLs or contact values.
    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-umami-event]") : null
      if (!element) return
      const data = Object.fromEntries(Object.entries(element.dataset)
        .filter(([key]) => key.startsWith("umamiEvent") && key !== "umamiEvent")
        .map(([key, value]) => [key.slice(10).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, ""), value]))
      trackGoogleEvent(element.dataset.umamiEvent || "", data)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [allowed, id, pathname, publicPage, ready])

  if (!id || !publicPage) return null
  return <>
    {(choice === null || preferencesOpen) ? <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg">
      <Alert role="region" aria-label="Optional Google analytics" className="p-4 shadow-lg">
        <AlertTitle>Allow visit analytics?</AlertTitle>
        <AlertDescription>
          We use optional Google Analytics cookies to understand visits and tender interactions.
          {" "}<a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">How Google uses data</a>.
        </AlertDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { setAnalyticsChoice("allowed"); setPreferencesOpen(false) }}>Allow analytics</Button>
          <Button size="sm" variant="outline" onClick={() => { setAnalyticsChoice("declined"); setPreferencesOpen(false) }}>No thanks</Button>
        </div>
      </Alert>
    </div> : <div className="fixed right-2 bottom-2 z-40 rounded-md bg-background/95"><Button variant="link" size="sm" onClick={() => setPreferencesOpen(true)}>Analytics preferences</Button></div>}
    {allowed && <Script id="openbids-google-bootstrap" strategy="afterInteractive" onReady={() => setReady(true)}>
      {`window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
        window.gtag('js', new Date());`}
    </Script>}
    {allowed && ready && <Script
      id="openbids-google-analytics"
      src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
      strategy="afterInteractive"
    />}
  </>
}
