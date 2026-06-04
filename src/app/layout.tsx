import type { Metadata } from "next";
import { Figtree, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { cn } from "@/lib/utils";

const figtreeHeading = Figtree({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl()),
  applicationName: SITE_NAME,
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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} - South African public tenders`,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_ZA",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} - South African public tenders`,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
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
        geistMono.variable,
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
      <Script
        data-website-id="628e3929-8181-451a-b427-8f5746434e4c"
        id="umami-analytics"
        src="https://cloud.umami.is/script.js"
        strategy="afterInteractive"
      />
    </html>
  );
}
