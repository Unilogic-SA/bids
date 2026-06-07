"use client"

import { useMemo, useState } from "react"
import {
  IconDownload,
  IconFileOff,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import { formatDate } from "@/lib/tenders/format"
import type { TenderDetail, TenderDocument } from "@/lib/tenders/types"
import { cn } from "@/lib/utils"

const IMAGE_EXTENSIONS = new Set(["gif", "jpeg", "jpg", "png", "webp"])
const OFFICE_EXTENSIONS = new Set([
  "doc",
  "docx",
  "odp",
  "ods",
  "odt",
  "pot",
  "potx",
  "pps",
  "ppsx",
  "ppt",
  "pptx",
  "rtf",
  "xls",
  "xlsm",
  "xlsx",
])
const DIRECT_FRAME_EXTENSIONS = new Set([
  "csv",
  "htm",
  "html",
  "json",
  "pdf",
  "text",
  "txt",
  "xml",
])

type PreviewMode =
  | {
      kind: "frame"
      src: string
    }
  | {
      kind: "image"
      src: string
    }
  | {
      kind: "unsupported"
    }

export function TenderDocuments({
  documents,
  tender,
}: {
  documents: TenderDocument[]
  tender: TenderDetail
}) {
  const [open, setOpen] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    documents[0]?.id || ""
  )
  const [imageZoom, setImageZoom] = useState(100)
  const selectedDocument = useMemo(
    () =>
      documents.find((document) => document.id === selectedDocumentId) ||
      documents[0],
    [documents, selectedDocumentId]
  )

  function openDocument(documentId: string) {
    setSelectedDocumentId(documentId)
    setImageZoom(100)
    setOpen(true)
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-5 lg:border-t-0 lg:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">Documents</h2>
        <Badge variant="secondary">{documents.length}</Badge>
      </div>

      {documents.length > 0 ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex flex-col">
            {documents.map((document, index) => (
              <div className="min-w-0" key={document.id}>
                <DocumentSummary
                  document={document}
                  onOpen={() => openDocument(document.id)}
                />
                {index < documents.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </div>

          {selectedDocument ? (
            <DocumentPreviewDialog
              documents={documents}
              selectedDocument={selectedDocument}
              selectedDocumentId={selectedDocument.id}
              imageZoom={imageZoom}
              setImageZoom={setImageZoom}
              setSelectedDocumentId={setSelectedDocumentId}
              tender={tender}
            />
          ) : null}
        </Dialog>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            No document links were included with this source record.
          </p>
          <Empty className="min-h-44">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconFileOff />
              </EmptyMedia>
              <EmptyTitle>No documents listed</EmptyTitle>
              <EmptyDescription>
                The source record does not include document links.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </section>
  )
}

function DocumentPreviewDialog({
  documents,
  selectedDocument,
  selectedDocumentId,
  imageZoom,
  setImageZoom,
  setSelectedDocumentId,
  tender,
}: {
  documents: TenderDocument[]
  selectedDocument: TenderDocument
  selectedDocumentId: string
  imageZoom: number
  setImageZoom: (imageZoom: number) => void
  setSelectedDocumentId: (documentId: string) => void
  tender: TenderDetail
}) {
  const previewMode = getPreviewMode(selectedDocument)
  const selectedTitle = getDocumentTitle(selectedDocument)

  return (
    <DialogContent className="bottom-2 left-2 right-2 top-2 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:h-[min(48rem,calc(100dvh-2rem))] sm:w-full sm:max-w-[min(72rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2">
      <DialogHeader className="border-b px-4 py-3 pr-12">
        <DialogTitle className="truncate">{selectedTitle}</DialogTitle>
        <DialogDescription className="truncate">
          {formatDocumentMeta(selectedDocument)}
        </DialogDescription>
      </DialogHeader>

      <MobileDocumentSelector
        documents={documents}
        selectedDocumentId={selectedDocumentId}
        setImageZoom={setImageZoom}
        setSelectedDocumentId={setSelectedDocumentId}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-hidden border-r lg:block">
          <div
            aria-label="Tender documents"
            className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain"
            role="list"
          >
            {documents.map((document) => {
              const isSelected = document.id === selectedDocumentId

              return (
                <button
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "flex min-w-0 flex-col gap-1 border-b px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isSelected && "bg-muted"
                  )}
                  key={document.id}
                  onClick={() => {
                    setSelectedDocumentId(document.id)
                    setImageZoom(100)
                  }}
                  type="button"
                >
                  <span className="line-clamp-2 break-words font-medium leading-5">
                    {getDocumentTitle(document)}
                  </span>
                  <span className="truncate text-xs leading-5 text-muted-foreground">
                    {formatDocumentMeta(document)}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {getPreviewLabel(previewMode)}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {previewMode.kind === "image" ? (
                <ImageZoomControls
                  imageZoom={imageZoom}
                  setImageZoom={setImageZoom}
                />
              ) : null}
              <Button asChild size="sm">
                <a
                  data-umami-event="tender_document_download"
                  data-umami-event-extension={
                    selectedDocument.file_extension || "unknown"
                  }
                  data-umami-event-index={String(
                    selectedDocument.document_index
                  )}
                  data-umami-event-ocid={tender.ocid}
                  data-umami-event-source={
                    selectedDocument.document_source || "unknown"
                  }
                  download={selectedDocument.file_name || undefined}
                  href={selectedDocument.document_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <IconDownload data-icon="inline-start" />
                  Download
                </a>
              </Button>
            </div>
          </div>

          <DocumentPreview
            imageZoom={imageZoom}
            previewMode={previewMode}
            title={selectedTitle}
          />
        </section>
      </div>
    </DialogContent>
  )
}

function MobileDocumentSelector({
  documents,
  selectedDocumentId,
  setImageZoom,
  setSelectedDocumentId,
}: {
  documents: TenderDocument[]
  selectedDocumentId: string
  setImageZoom: (imageZoom: number) => void
  setSelectedDocumentId: (documentId: string) => void
}) {
  return (
    <div className="border-b px-4 py-3 lg:hidden">
      <Field className="gap-2">
        <FieldLabel htmlFor="mobile-document-select">Document</FieldLabel>
        <NativeSelect
          className="w-full"
          id="mobile-document-select"
          onChange={(event) => {
            setSelectedDocumentId(event.target.value)
            setImageZoom(100)
          }}
          value={selectedDocumentId}
        >
          {documents.map((document, index) => (
            <NativeSelectOption key={document.id} value={document.id}>
              {`${index + 1}. ${getDocumentTitle(document)}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  )
}

function DocumentSummary({
  document,
  onOpen,
}: {
  document: TenderDocument
  onOpen: () => void
}) {
  return (
    <button
      className="flex w-full min-w-0 cursor-pointer flex-col gap-1 rounded-md py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onOpen}
      type="button"
    >
      <span className="break-words text-sm font-medium leading-5 text-primary underline-offset-4 hover:underline">
        {getDocumentTitle(document)}
      </span>
      <span className="text-xs leading-5 text-muted-foreground">
        {formatDocumentMeta(document)}
      </span>
    </button>
  )
}

function ImageZoomControls({
  imageZoom,
  setImageZoom,
}: {
  imageZoom: number
  setImageZoom: (imageZoom: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label="Zoom out"
        disabled={imageZoom <= 50}
        onClick={() => setImageZoom(Math.max(50, imageZoom - 25))}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <IconZoomOut />
      </Button>
      <Button
        onClick={() => setImageZoom(100)}
        size="sm"
        type="button"
        variant="outline"
      >
        {imageZoom}%
      </Button>
      <Button
        aria-label="Zoom in"
        disabled={imageZoom >= 200}
        onClick={() => setImageZoom(Math.min(200, imageZoom + 25))}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <IconZoomIn />
      </Button>
    </div>
  )
}

function DocumentPreview({
  imageZoom,
  previewMode,
  title,
}: {
  imageZoom: number
  previewMode: PreviewMode
  title: string
}) {
  if (previewMode.kind === "image") {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-muted/50 p-4">
        <div className="flex min-h-full min-w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={title}
            className="max-w-none rounded-lg bg-background ring-1 ring-border"
            referrerPolicy="no-referrer"
            src={previewMode.src}
            style={{ width: `${imageZoom}%` }}
          />
        </div>
      </div>
    )
  }

  if (previewMode.kind === "frame") {
    return (
      <div className="min-h-0 flex-1 bg-muted/50">
        <iframe
          allow="fullscreen"
          className="h-full w-full bg-background"
          referrerPolicy="no-referrer"
          src={previewMode.src}
          title={title}
        />
      </div>
    )
  }

  return (
    <Empty className="min-h-0 flex-1 rounded-none border-0 bg-muted/50">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconFileOff />
        </EmptyMedia>
        <EmptyTitle>Preview unavailable</EmptyTitle>
        <EmptyDescription>
          This document type is not supported in the embedded viewer.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function getPreviewMode(document: TenderDocument): PreviewMode {
  const extension = getDocumentExtension(document)

  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      kind: "image",
      src: document.document_url,
    }
  }

  if (OFFICE_EXTENSIONS.has(extension)) {
    return {
      kind: "frame",
      src: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
        document.document_url
      )}`,
    }
  }

  if (DIRECT_FRAME_EXTENSIONS.has(extension)) {
    return {
      kind: "frame",
      src:
        extension === "pdf"
          ? getPdfPreviewUrl(document.document_url)
          : document.document_url,
    }
  }

  return { kind: "unsupported" }
}

function getPreviewLabel(previewMode: PreviewMode) {
  if (previewMode.kind === "image") return "Image preview"
  if (previewMode.kind === "frame") return "Embedded document preview"
  return "Download required"
}

function getDocumentTitle(document: TenderDocument) {
  return (
    cleanText(document.document_title) ||
    cleanText(document.file_name) ||
    "Document"
  )
}

function formatDocumentMeta(document: TenderDocument) {
  const metadata = [
    cleanText(document.file_extension).toLocaleUpperCase("en-ZA"),
    cleanText(document.file_size_text),
    document.date_published
      ? `Published ${formatDate(document.date_published)}`
      : "",
  ].filter(Boolean)

  return metadata.length ? metadata.join(" / ") : "Details not supplied"
}

function getDocumentExtension(document: TenderDocument) {
  const extension = normalizeExtension(document.file_extension)
  if (extension) return extension

  return normalizeExtension(getFileNameFromUrl(document.document_url))
}

function getFileNameFromUrl(value: string) {
  try {
    const url = new URL(value)
    const downloadedFileName = url.searchParams.get("downloadedFileName")

    return downloadedFileName || url.pathname.split("/").pop() || ""
  } catch {
    return value
  }
}

function normalizeExtension(value?: string | null) {
  const candidate = cleanText(value).toLowerCase().replace(/^\./, "")
  const extension = candidate.includes(".")
    ? candidate.split(".").pop() || ""
    : candidate

  return extension.replace(/[^a-z0-9]/g, "")
}

function getPdfPreviewUrl(value: string) {
  const params = new URLSearchParams({ url: value })

  return `/api/document-preview?${params.toString()}#toolbar=1&navpanes=0`
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || ""
}
