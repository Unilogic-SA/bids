# Google Search launch measurement

The launch is a website traffic test: one Search campaign, R20 average daily
budget, Maximise Clicks, an initial R3 maximum CPC, South Africa presence
targeting, English, phrase/exact tender-search terms. Display and Search Partners
are off. The R3 cap is a starting guardrail, not a CPC forecast; review impressions
and search terms before changing it. The campaign remains in onboarding until
the owner completes billing/terms. Negative keywords and auto-tagging must be
checked in the full account after onboarding, before enabling delivery.

## Enable measurement

1. Complete the prepared Google Analytics account/property setup (OpenBids /
   OpenBids Web, South Africa time, ZAR). The owner must accept Google's terms.
2. Create a Web data stream for `https://www.openbid.co.za` and copy its actual
   `G-...` measurement ID. Disable **Enhanced measurement** on that stream.
   This app sends page views itself; automatic history, outbound-link, download,
   form and site-search measurement can duplicate events or expose raw URLs.
3. The actual public web-stream ID is set in tracked `.env.production` (no
   secrets). `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` may override it in Vercel.
   Google collection is restricted to `openbid.co.za` and `www.openbid.co.za`;
   preview/local hosts never collect into the live property. No Ads tag ID or
   conversion label is fabricated. Google measurement is disabled without a
   valid ID. Existing Umami measurement remains active.
4. Verify GA4 Realtime/DebugView using a tagged visit, opening a tender, and
   clicking a bid document. Check one page_view per route navigation, and
   `tender_result_open`, `tender_document_download`, and `tender_filter_apply`.
   The download event measures a link click, not a successful file download.
   Filter changes on the same page are engagement events, not extra page views.
5. Link the completed GA4 property to the matching OpenBid Google Ads account.
   Keep tender engagement events as observational/secondary signals initially.
   Do not optimise for conversions or count every page view as a conversion.
   Completed signup is not measured by this change.

The campaign's Final URL suffix is:

```
utm_source=google&utm_medium=cpc&utm_campaign=openbids_search_launch&utm_id={campaignid}&utm_term={keyword}&utm_content={creative}
```

Google loads only after the visitor chooses **Allow analytics** in a compact
shadcn notice. **No thanks** keeps it disabled; **Analytics preferences** lets
visitors change that choice later. The notice discloses optional analytics
cookies and links to Google's data-use explanation. No collection starts merely
because the measurement ID is configured.

Google receives allowlisted tender interaction fields, generic page titles and
sanitised public URLs. Search/buyer text, auth parameters, contact values and
document URLs are excluded. Tender page URLs use a generic `/tenders/detail`
measurement path so arbitrary route segments never reach Google. Virtual
referrers advance between page navigations. Public routes are `/` and individual tender pages;
account, workspace, auth, API and admin routes do not send custom events or
page views, and Google's analytics disable flag is set on those routes. Enhanced
measurement must remain off as above. Google Signals and ad personalisation
signals are disabled. This is measurement integration, not a remarketing setup.

Allowlisted campaign values are kept in sessionStorage so existing programmatic
Umami engagement events keep their campaign attribution after navigating into a
tender. Blocked storage, missing Google tags and blocked scripts do not prevent
navigation. No Google measurement is claimed live until deployment and Realtime
verification have succeeded.

## Before activating the campaign

- Confirm the displayed budget is R20 and the click cap is R3. Google can spend
  up to R40 on an individual day; the usual monthly charging limit is R608
  with an unchanged R20 budget, excluding any applicable taxes.
- Check auto-tagging is enabled. Add campaign-level negative keywords for
  unrelated searches, such as jobs, vacancies, careers, internships, courses,
  and Ireland; use search-term evidence before excluding legitimate tender topics.
- Verify actual documents and closing dates on the landing page. Ads describe
  tender search/documents, not alerts or workspace functionality.
- Review search terms, clicks, CPC and tender engagement after the first week.
  At this budget, avoid splitting spend across multiple campaigns.

References: [Google budgeting](https://support.google.com/google-ads/answer/6385083),
[Maximise Clicks](https://support.google.com/google-ads/answer/6336101),
[GA4 manual page views](https://developers.google.com/analytics/devguides/collection/ga4/views).
