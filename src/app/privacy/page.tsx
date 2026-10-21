import { PublicArticle } from "@/components/public-article"
import { pageMetadata } from "@/lib/seo"
const title = "Privacy and analytics"
const description =
  "What OpenBids uses to provide account, workspace and public tender discovery features."
export const metadata = pageMetadata(title, description, "/privacy")
export default function Page() {
  return (
    <PublicArticle title={title} description={description} path="/privacy">
      <section>
        <h2>Accounts and workspaces</h2>
        <p>
          OpenBids is operated by Unilogic (Pty) Ltd. Account details, authentication information,
          saved tenders, preparation checklists, bid stages and workspace memberships are used to
          provide the service. Workspace invitations use the invited email address and include
          information about the workspace and inviter.
        </p>
        <p>
          Workspace information is shared with the members of that workspace. It is not part of the
          public tender directory. Consider what you include in a shared checklist and who has
          access to your workspace.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          OpenBids uses Vercel for hosting, Supabase for data and authentication, and Resend for
          workspace invitation delivery. Google sign-in is available as an optional authentication
          method. These providers process information needed to deliver the features you use.
        </p>
      </section>
      <section>
        <h2>Visit measurement</h2>
        <p>
          OpenBids uses Umami for visit and interaction measurement. Google Analytics, where
          configured, follows the optional analytics choice shown in the application. Declining
          optional Google Analytics does not prevent you from browsing tenders.
        </p>
        <p>
          Authentication, workspace preferences and an analytics choice can use cookies or browser
          storage. These serve different purposes. Your browser settings can clear stored data,
          which may sign you out or reset preferences.
        </p>
      </section>
      <section>
        <h2>Official documents and external links</h2>
        <p>
          Opening an official source, document, calendar service or buyer website can send your
          browser to a separate provider. That provider applies its own privacy practices. Public
          procurement contact details in a notice originate from the publishing source.
        </p>
      </section>
      <section>
        <h2>Take care with public reports</h2>
        <p>
          The project’s public issue tracker is for public listing and product errors. Do not post
          account credentials, email addresses, invitation links or private workspace information
          there.
        </p>
      </section>
    </PublicArticle>
  )
}
