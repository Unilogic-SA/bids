import { PublicArticle } from "@/components/public-article"
import { pageMetadata } from "@/lib/seo"
const title = "Using OpenBids"
const description =
  "Important service information for discovering public tenders and preparing responses with OpenBids."
export const metadata = pageMetadata(title, description, "/terms")
export default function Page() {
  return (
    <PublicArticle title={title} description={description} path="/terms">
      <section>
        <h2>Purpose of the service</h2>
        <p>
          OpenBids, operated by Unilogic (Pty) Ltd, organizes public tender information and provides
          tools for preparation and tracking. It is independent of the issuing buyers and the
          official eTenders portal.
        </p>
      </section>
      <section>
        <h2>Check the official requirements</h2>
        <p>
          Use the official notice, complete document pack and amendments to determine what a
          response must contain. Listings and guides may be incomplete or delayed and do not
          establish eligibility or replace the buyer’s instructions.
        </p>
      </section>
      <section>
        <h2>Submission happens with the buyer</h2>
        <p>
          Saving an opportunity, updating a checklist or recording a Submitted stage does not submit
          a bid. You are responsible for using the required submission channel and checking the
          actual deadline.
        </p>
      </section>
      <section>
        <h2>Accounts and shared work</h2>
        <p>
          Keep your account secure. Share workspace access only with people who should see its
          contents. Check the recipients before sending invitations and take care when changing
          shared preparation information.
        </p>
      </section>
      <section>
        <h2>Source material and availability</h2>
        <p>
          Official notices and documents remain attributable to their sources. External documents
          and services may change or become unavailable. The directory and its preparation tools do
          not promise a procurement outcome.
        </p>
      </section>
    </PublicArticle>
  )
}
