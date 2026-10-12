"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"
import {
  currentCampaign, googleMeasurementId, isMeasurementPage, measurementReferrer,
  measurementUrl, trackGoogleEvent,
} from "@/lib/google-analytics"

export function GoogleAnalytics() {
  const pathname = usePathname()
  const id = googleMeasurementId(process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID)
  const [ready, setReady] = useState(false)
  const publicPage = isMeasurementPage(pathname)

  useEffect(() => {
    if (!id) return
    // Google respects this flag even after its script has loaded on a previous page.
    Object.assign(window, { [`ga-disable-${id}`]: !publicPage })
    if (!publicPage) return
    currentCampaign()
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || []
      window.gtag = (...args: unknown[]) => { window.dataLayer?.push(args) }
      window.gtag("js", new Date())
    }
    window.gtag("config", id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: measurementUrl(new URL(window.location.href)),
      page_referrer: measurementReferrer(document.referrer),
      page_title: pathname === "/" ? "OpenBids tender search" : "OpenBids tender detail",
    })
    if (!ready) return

    const sendPageView = () => window.gtag?.("event", "page_view", {
      send_to: id,
      page_location: measurementUrl(new URL(window.location.href)),
      page_referrer: measurementReferrer(document.referrer),
      page_title: window.location.pathname === "/" ? "OpenBids tender search" : "OpenBids tender detail",
    })
    sendPageView()
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
  }, [id, pathname, publicPage, ready])

  if (!id || !publicPage) return null
  return <Script
    id="openbids-google-analytics"
    src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
    strategy="afterInteractive"
    onReady={() => setReady(true)}
  />
}
