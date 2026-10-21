import type { Metadata } from "next"
import localFont from "next/font/local"
import Script from "next/script"
import "./globals.css"
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, publicRobots, stringifyJsonLd } from "@/lib/seo"
import { cn } from "@/lib/utils"
import { PublicAppHeader } from "@/components/public-app-header"
import { WorkspaceProvider } from "@/components/workspace/workspace-provider"
import { AccountProvider } from "@/components/account/account-provider"
import { GoogleAnalytics } from "@/components/google-analytics"

const figtreeHeading = localFont({
  src: "./fonts/figtree.woff2",
  weight: "300 900",
  display: "swap",
  variable: "--font-heading",
})

const inter = localFont({
  src: "./fonts/inter.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sans",
})

const geistMono = localFont({
  src: "./fonts/geist-mono.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl()),
  applicationName: SITE_NAME,
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
  title: {
    default: `${SITE_NAME} - South African public tenders`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "South African tenders",
    "public tenders",
    "government tenders",
    "RFQ",
    "RFP",
    "bid documents",
    "procurement opportunities",
  ],
  openGraph: {
    title: `${SITE_NAME} - South African public tenders`,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_ZA",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OpenBids — South African public tenders",
      },
    ],
  },
  robots: publicRobots(),
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
    title: `${SITE_NAME} - South African public tenders`,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        inter.variable,
        figtreeHeading.variable,
        geistMono.variable
      )}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: stringifyJsonLd({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${absoluteUrl("/")}#organization`,
              name: SITE_NAME,
              url: absoluteUrl("/"),
              logo: absoluteUrl("/icon.svg"),
            }),
          }}
        />
        <GoogleAnalytics />
        <AccountProvider>
          <WorkspaceProvider>
            <PublicAppHeader />
            {children}
          </WorkspaceProvider>
        </AccountProvider>
      </body>
      <Script
        data-website-id="628e3929-8181-451a-b427-8f5746434e4c"
        id="umami-analytics"
        src="https://cloud.umami.is/script.js"
        strategy="afterInteractive"
      />
    </html>
  )
}
