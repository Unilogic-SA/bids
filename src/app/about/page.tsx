import Link from "next/link"
import { PublicArticle } from "@/components/public-article"
import { pageMetadata } from "@/lib/seo"
const title = "About OpenBids and our sources"
const description =
  "How OpenBids collects and organizes South African public tender notices, and what to check before preparing a bid."
export const metadata = pageMetadata(title, description, "/about")
export default function Page() {
  return (
    <PublicArticle title={title} description={description} path="/about">
      <section>
        <h2>An independent tool for suppliers</h2>
        <p>
          OpenBids is operated by Unilogic (Pty) Ltd. It helps suppliers discover South African
          public tenders, save opportunities, prepare responses and track their bid progress.
          OpenBids is independent of National Treasury and the issuing buyers.
        </p>
      </section>
      <section>
        <h2>Official source information</h2>
        <p>
          Our catalog uses National Treasury’s{" "}
          <a href="https://ocds-api.etenders.gov.za/api/OCDSReleases">eTenders OCDS releases API</a>{" "}
          and available eTenders notice information. The{" "}
          <a href="https://www.etenders.gov.za/Home/About">official eTenders portal</a> publishes
          notices, documents and amendments. OpenBids organizes this source information; it does not
          issue the tenders.
        </p>
        <p>
          Coverage depends on what the source publishes and what has synchronized successfully.
          OpenBids does not claim to include every procurement opportunity or every amendment
          immediately. Check the official notice and document pack before responding.
        </p>
      </section>
      <section>
        <h2>Dates, status and freshness</h2>
        <p>
          Times are displayed in South African Standard Time. Open collections exclude notices whose
          recorded closing time has passed. Closed notices may remain available for reference. A
          passed closing time does not establish that a contract was awarded.
        </p>
        <p>
          A notice’s last-updated date refers to recorded source information. Source changes,
          missing fields and synchronization delays can affect what you see. A newly imported record
          is not necessarily a newly published tender.
        </p>
      </section>
      <section>
        <h2>How browse pages are grouped</h2>
        <p>
          Province collections use the province classification in the source feed. This can differ
          from a buyer’s head-office location or a specific delivery site. National notices have
          their own collection.
        </p>
        <p>
          Industry collections use selected official classifications and procurement-subject
          matching. These are discovery aids, not eligibility assessments. Buyer collections use
          reviewed exact buyer names; separately named entities are not automatically combined.
        </p>
      </section>
      <section>
        <h2>Documents and preparation</h2>
        <p>
          Documents remain attributable to their issuing source. Availability can depend on the
          external host. OpenBids summaries, checklists and guides do not replace the full pack or
          the buyer’s instructions.
        </p>
        <p>
          Saving a tender, changing a Workspace stage or recording submission does not deliver a
          bid. Submit through the buyer’s specified channel and retain proof where available.
        </p>
      </section>
      <section>
        <h2>Corrections</h2>
        <p>
          For an official requirement or deadline, contact the issuing buyer using the details in
          the tender pack. Public listing errors can be reported through the{" "}
          <a href="https://github.com/Unilogic-SA/bids/issues">OpenBids issue tracker</a>; include
          the reference and source link, and do not post personal information or private workspace
          content.
        </p>
      </section>
      <p>
        <Link href="/guides">Read the preparation guides</Link> or{" "}
        <Link href="/tenders">browse current opportunities</Link>.
      </p>
    </PublicArticle>
  )
}
