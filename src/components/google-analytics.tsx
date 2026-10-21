"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"
import {
  analyticsAllowed, analyticsChoice, currentCampaign, googleMeasurementId, isMeasurementPage,
  nextMeasurementContext, setAnalyticsChoice, subscribeAnalyticsChoice, trackGoogleEvent,
} from "@/lib/google-analytics"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
    <footer className="px-4 py-3 text-center text-xs text-muted-foreground">
      <Popover open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <PopoverTrigger asChild>
          <Button variant="link" size="sm" className="text-xs text-muted-foreground">Privacy preferences</Button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-72 p-4" aria-label="Privacy preferences">
          <h2 className="font-medium">Privacy preferences</h2>
          <p className="text-xs text-muted-foreground">We use cookieless Umami analytics to understand how OpenBids is used. Essential cookies keep you signed in.</p>
          <p className="text-xs text-muted-foreground">Google Analytics is optional and uses cookies on public tender pages. It is {choice === "allowed" ? "on" : "off"}.</p>
          <a className="text-xs underline underline-offset-4" href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">How Google uses data</a>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { setAnalyticsChoice("allowed"); setPreferencesOpen(false) }}>Allow Google analytics</Button>
            <Button size="sm" variant="outline" onClick={() => { setAnalyticsChoice("declined"); setPreferencesOpen(false) }}>Turn off Google analytics</Button>
          </div>
        </PopoverContent>
      </Popover>
    </footer>
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
