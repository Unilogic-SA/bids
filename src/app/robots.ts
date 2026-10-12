import type { MetadataRoute } from "next"

import { absoluteUrl, getSiteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/workspace", "/api/", "/?*q=", "/?*buyer=", "/?*page="],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  }
}
