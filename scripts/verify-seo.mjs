/** Read-only HTTP contracts. Run against the tested deployment before/after release. */
import assert from "node:assert/strict"
const base = process.env.SEO_VERIFY_BASE_URL || "https://www.openbid.co.za"
const origin = "https://www.openbid.co.za"
const cases = [
  ["/", true],
  ["/?page=2", true],
  ["/?q=software", false],
  ["/tenders", true],
  ["/tenders/province/gauteng", true],
  ["/tenders/province/gauteng?page=2", true],
  ["/tenders/industry/information-technology", true],
  ["/tenders/industry/marketing", true],
  ["/tenders/buyer/sita", true],
  ["/about", true],
  ["/guides", true],
  ["/guides/tender-response-checklist", true],
  ["/privacy", true],
  ["/terms", true],
  ["/sign-in", false],
]
let failures = 0
for (const [path, index] of cases) {
  try {
    const response = await fetch(new URL(path, base), {
      headers: { "User-Agent": "Googlebot" },
      signal: AbortSignal.timeout(45000),
    })
    assert.equal(response.status, 200)
    const html = await response.text()
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
    assert.ok(title?.includes("OpenBids"), `Missing branded title: ${title}`)
    const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] || ""
    const isPreview = process.env.SEO_VERIFY_PREVIEW === "1"
    assert.equal(robots.includes("noindex"), isPreview || !index, `Unexpected robots: ${robots}`)
    if (index) {
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
      assert.equal(canonical?.replace(/\/$/, ""), new URL(path, origin).href.replace(/\/$/, ""))
      assert.equal((html.match(/<h1\b/g) || []).length, 1, "Expected one visible H1")
    }
    assert.ok(!html.includes("Something went wrong"), "Error shell rendered")
    for (const [, json] of html.matchAll(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
    ))
      JSON.parse(json)
    console.log(`PASS ${path}`)
  } catch (error) {
    failures++
    console.error(`FAIL ${path}: ${error.message}`)
  }
}
for (const path of [
  "/tenders/industry/unknown",
  "/guides/unknown",
  "/tenders/buyer/sita?page=999",
]) {
  try {
    const response = await fetch(new URL(path, base), {
      headers: { "User-Agent": "Googlebot" },
      signal: AbortSignal.timeout(45000),
    })
    const html = await response.text()
    // Next may stream a not-found boundary with 200; its noindex is mandatory.
    assert.ok(
      response.status === 404 ||
        (response.status === 200 && /name="robots" content="noindex/.test(html)),
      `Invalid page returned ${response.status} without noindex`
    )
    console.log(`PASS excluded ${path} (${response.status})`)
  } catch (error) {
    failures++
    console.error(`FAIL ${path}: ${error.message}`)
  }
}
try {
  const response = await fetch(new URL("/sitemap.xml", base), {
    signal: AbortSignal.timeout(60000),
  })
  assert.equal(response.status, 200)
  const xml = await response.text()
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
  assert.equal(new Set(urls).size, urls.length, "Duplicate sitemap URLs")
  assert.ok(
    urls.length >= Number(process.env.SEO_MIN_SITEMAP_URLS || 1000),
    `Sitemap dropped to ${urls.length} URLs`
  )
  assert.ok(
    urls.every((url) => url.startsWith(origin + "/") && !url.includes("?")),
    "Noncanonical sitemap URL"
  )
  console.log(`PASS sitemap: ${urls.length} unique canonical URLs`)
  const robots = await (await fetch(new URL("/robots.txt", base))).text()
  assert.ok(!robots.includes("?*page="), "Pagination remains blocked")
  assert.ok(robots.includes(`${origin}/sitemap.xml`), "Missing canonical sitemap reference")
} catch (error) {
  failures++
  console.error(`FAIL sitemap/robots: ${error.message}`)
}
process.exitCode = failures ? 1 : 0
