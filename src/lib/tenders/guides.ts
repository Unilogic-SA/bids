export type Guide = {
  slug: string
  title: string
  description: string
  sections: { title: string; paragraphs?: string[]; steps?: string[] }[]
  related: string[]
}
export const GUIDES: Guide[] = [
  {
    slug: "tender-response-checklist",
    title: "A practical tender response checklist",
    description:
      "A working checklist for reading a public tender, preparing your response and checking it before submission.",
    sections: [
      {
        title: "Start with the official tender pack",
        paragraphs: [
          "Match the reference number, buyer and procurement subject. Read the notice, every attachment and any amendment together. A listing summary helps you find an opportunity; it does not replace the buyer’s instructions.",
        ],
        steps: [
          "Record the closing date, time and submission method.",
          "Check whether a briefing is compulsory and whether you can still attend.",
          "Identify the scope, delivery locations and contract period.",
          "Find the evaluation criteria and all mandatory response requirements.",
        ],
      },
      {
        title: "Build the response around this tender",
        paragraphs: [
          "Use a separate checklist for each opportunity. Only include requirements that apply to the notice you are answering; a generic checklist cannot establish eligibility.",
        ],
        steps: [
          "List each required form and supporting document.",
          "Check signature, date, certification and validity instructions where specified.",
          "Prepare the technical response against the stated scope.",
          "Complete the pricing schedule in the required format and check totals.",
          "Assign time for a final check before the submission deadline.",
        ],
      },
      {
        title: "Check and submit through the specified channel",
        steps: [
          "Confirm that all files or physical documents are included and readable.",
          "Check the reference number, file names and any packaging instructions.",
          "Recheck amendments and the final closing time.",
          "Submit through the buyer’s designated channel and keep proof where available.",
        ],
        paragraphs: [
          "Saving a tender or recording a Submitted stage in OpenBids does not send a bid to the buyer. Actual submission happens outside OpenBids.",
        ],
      },
      {
        title: "Keep preparation in one place",
        paragraphs: [
          "Save the notice to Workspace, adapt its preparation checklist to the tender pack, and track your stage as work progresses. If you use a shared workspace, check the preparation state together before recording submission.",
        ],
      },
    ],
    related: ["reading-a-tender-notice", "closing-dates-and-briefings"],
  },
  {
    slug: "reading-a-tender-notice",
    title: "How to read a South African tender notice",
    description:
      "Understand a tender’s reference, buyer, scope, documents and submission instructions before deciding whether to respond.",
    sections: [
      {
        title: "Identify the opportunity",
        paragraphs: [
          "Start with the tender reference and the issuing buyer. Similar titles can refer to different notices, and a re-advertisement may have a different deadline or pack. Use the reference when comparing the listing with the official source.",
        ],
      },
      {
        title: "Separate the summary from the requirements",
        paragraphs: [
          "Read the procurement subject to decide whether the work fits your business. Then open the documents: they may describe quantities, deliverables, specifications, evaluation criteria and response forms that are not visible in the short notice.",
        ],
      },
      {
        title: "Check practical constraints early",
        steps: [
          "Confirm the closing time and the buyer’s submission channel.",
          "Check briefing attendance and whether it is compulsory.",
          "Read delivery locations, service periods and response validity requirements.",
          "Check for amendments before you finalize pricing or submit.",
        ],
        paragraphs: [
          "If information is missing or contradictory, use the contact details in the official pack to ask the buyer. Do not fill gaps with assumptions from another tender.",
        ],
      },
      {
        title: "Decide whether to prepare a response",
        paragraphs: [
          "Assess your ability to meet the scope and stated requirements, the time left to prepare, and the cost of delivery. Save suitable opportunities to Workspace and build a notice-specific checklist.",
        ],
      },
    ],
    related: ["tender-response-checklist", "rfq-vs-rfp"],
  },
  {
    slug: "rfq-vs-rfp",
    title: "RFQ vs RFP: what to check before responding",
    description:
      "A practical explanation of requests for quotation and requests for proposal, and how to use the actual tender pack to prepare a response.",
    sections: [
      {
        title: "RFQ: request for quotation",
        paragraphs: [
          "An RFQ generally asks suppliers to quote against a described need. Look for the specification, quantities, delivery schedule and pricing format. The label alone does not mean a response needs only a price: the pack may require supporting forms and other evidence.",
        ],
      },
      {
        title: "RFP: request for proposal",
        paragraphs: [
          "An RFP generally asks suppliers to explain an approach or solution as well as commercial terms. Read the scope and evaluation criteria carefully so that the proposed method, experience and pricing answer the buyer’s actual request.",
        ],
      },
      {
        title: "The notice controls the response",
        paragraphs: [
          "Procurement labels and publication formats vary. Do not infer a monetary threshold, evaluation method or eligibility rule from the abbreviation alone. Use the official pack, amendments and buyer’s clarification process for the opportunity in front of you.",
        ],
      },
      {
        title: "Compare the work required",
        steps: [
          "What exactly is being purchased?",
          "Which technical and commercial documents are required?",
          "How will the response be evaluated?",
          "When, where and how must it be submitted?",
        ],
        paragraphs: [
          "Discover includes a procurement-type filter for RFQs, RFPs and other source classifications. Use it to narrow your search, then read each notice in full.",
        ],
      },
    ],
    related: ["reading-a-tender-notice", "tender-response-checklist"],
  },
  {
    slug: "closing-dates-and-briefings",
    title: "Track tender closing dates and briefings",
    description:
      "Plan around public tender deadlines and compulsory briefings, check amendments and use calendar reminders alongside your bid checklist.",
    sections: [
      {
        title: "Record the exact date and time",
        paragraphs: [
          "OpenBids presents tender times in South African Standard Time (SAST). Record the absolute date and time from the official notice rather than relying only on a relative label such as ‘tomorrow’. Leave time for the buyer’s submission process.",
        ],
      },
      {
        title: "Check briefings before committing time",
        paragraphs: [
          "A briefing can have a different venue and an earlier deadline than the bid itself. Check whether attendance is compulsory, how to register if required, and whether an online link or physical address has been supplied. Missing information is not proof that no briefing applies.",
        ],
      },
      {
        title: "Use calendar reminders as a backup",
        paragraphs: [
          "Use the tender’s calendar action to add a closing date to Google Calendar. A briefing option is available when the notice includes a briefing date. Check the created event, its time zone and your reminder settings. A calendar event is not confirmation that the buyer has not changed the deadline.",
        ],
      },
      {
        title: "Recheck before submission",
        steps: [
          "Reopen the official pack and check for amendments.",
          "Confirm the final closing time, destination and submission method.",
          "Leave a margin for uploads, travel or delivery.",
          "Keep proof of actual submission where the process provides it.",
        ],
        paragraphs: [
          "A saved notice, reminder or preparation stage does not submit a bid. Closed notices remain useful for reference, but should not be treated as open opportunities.",
        ],
      },
    ],
    related: ["tender-response-checklist", "reading-a-tender-notice"],
  },
]
export function guidePath(slug: string) {
  return `/guides/${slug}`
}
export function findGuide(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug)
}
