"use client"

import { useEffect, useMemo, useState } from "react"
import {
  IconDownload,
  IconChevronRight,
  IconExternalLink,
  IconFileText,
  IconFileOff,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
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
  sourceUrl,
  tender,
}: {
  documents: TenderDocument[]
  sourceUrl?: string
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
    <>
      <Card className="gap-0 shadow-none">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Documents</h2>
            <Badge variant="secondary">{documents.length}</Badge>
          </div>
          {documents.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Preview the files before preparing your bid.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="px-2 pt-2">
          {documents.length > 0 ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <ScrollArea
                aria-label="Bid documents"
                className={cn(
                  "[&_[data-slot=scroll-area-viewport]]:overscroll-contain",
                  documents.length > 3 && "h-80 sm:h-96"
                )}
                type="always"
              >
                <div className="flex flex-col gap-1 pr-2">
                  {documents.map((document) => (
                    <DocumentSummary
                      document={document}
                      key={document.id}
                      onOpen={() => openDocument(document.id)}
                    />
                  ))}
                </div>
              </ScrollArea>

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
            <Empty className="gap-3 border-0 px-3 py-5">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconFileOff />
                </EmptyMedia>
                <EmptyTitle>No documents listed</EmptyTitle>
                <EmptyDescription>
                  Document links weren’t supplied with this notice.
                  {sourceUrl
                    ? " Check eTenders for the bid pack."
                    : " Check with the buyer for the bid pack."}
                </EmptyDescription>
              </EmptyHeader>
              {sourceUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-umami-event="tender_source_open"
                    data-umami-event-location="documents_empty"
                    data-umami-event-ocid={tender.ocid}
                  >
                    <IconExternalLink data-icon="inline-start" />
                    View on eTenders
                  </a>
                </Button>
              ) : null}
            </Empty>
          )}
        </CardContent>
      </Card>
    </>
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
                <Button
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "h-auto w-full min-w-0 cursor-pointer flex-col items-start gap-1 rounded-none px-4 py-3 text-left text-sm whitespace-normal",
                    isSelected && "bg-muted"
                  )}
                  key={document.id}
                  onClick={() => {
                    setSelectedDocumentId(document.id)
                    setImageZoom(100)
                  }}
                  type="button"
                  variant="ghost"
                >
                  <span className="line-clamp-2 break-words font-medium leading-5 text-primary">
                    {getDocumentTitle(document)}
                  </span>
                  <span className="truncate text-xs leading-5 text-muted-foreground">
                    {formatDocumentMeta(document)}
                  </span>
                </Button>
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
                  onClick={() =>
                    toast("Opening download", { id: "document-download" })
                  }
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
            key={selectedDocument.id}
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
    <Button
      aria-label={`Preview ${getDocumentTitle(document)}`}
      className="h-auto w-full min-w-0 cursor-pointer justify-start gap-2.5 px-2 py-3 text-left whitespace-normal"
      onClick={onOpen}
      type="button"
      variant="ghost"
    >
      <IconFileText
        aria-hidden="true"
        className="size-5 self-start text-primary"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-3 break-words text-sm font-medium leading-5 text-primary">
          {getDocumentTitle(document)}
        </span>
        <span className="text-xs font-normal leading-4 text-muted-foreground">
          {formatDocumentMeta(document)}
        </span>
      </span>
      <IconChevronRight
        aria-hidden="true"
        className="size-3.5 text-muted-foreground"
      />
    </Button>
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
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (loaded || failed || previewMode.kind === "unsupported") return
    const timer = window.setTimeout(() => setSlow(true), 12_000)
    return () => window.clearTimeout(timer)
  }, [loaded, failed, previewMode.kind])

  if (previewMode.kind === "unsupported" || failed) {
    return (
      <Empty className="min-h-0 flex-1 rounded-none border-0 bg-muted/50">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconFileOff />
          </EmptyMedia>
          <EmptyTitle>Preview unavailable</EmptyTitle>
          <EmptyDescription>
            {failed
              ? "We couldn’t load this preview. Download the document above to view it."
              : "Download the document above to view this file type."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div
      className="relative min-h-0 flex-1 overflow-auto bg-muted/50"
      aria-busy={!loaded}
    >
      {!loaded ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-muted/50 p-6">
          <div
            aria-hidden="true"
            className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-background p-6 ring-1 ring-border"
          >
            <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-full motion-reduce:animate-none" />
            <Skeleton className="h-3 w-5/6 motion-reduce:animate-none" />
            <Skeleton className="h-32 w-full motion-reduce:animate-none" />
          </div>
          <div
            className="flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
          >
            <Spinner
              aria-hidden="true"
              className="motion-reduce:animate-none"
            />
            {slow
              ? "Still loading. You can download the file above."
              : "Loading preview…"}
          </div>
        </div>
      ) : null}
      {previewMode.kind === "image" ? (
        <div className="flex min-h-full min-w-full items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={title}
            className={cn(
              "max-w-none rounded-lg bg-background ring-1 ring-border",
              !loaded && "opacity-0"
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
            src={previewMode.src}
            style={{ width: `${imageZoom}%` }}
          />
        </div>
      ) : (
        <iframe
          allow="fullscreen"
          className={cn("h-full w-full bg-background", !loaded && "opacity-0")}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={previewMode.src}
          title={title}
        />
      )}
    </div>
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
