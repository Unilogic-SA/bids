import type { MetadataRoute } from "next"
import { absoluteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: process.env.VERCEL_ENV === "preview" ? ["/"] : ["/api/", "/auth/", "/join/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  }
}
