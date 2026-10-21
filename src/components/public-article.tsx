import type { ReactNode } from "react"
import { SeoBreadcrumbs } from "@/components/seo-breadcrumbs"
import { PublicFooter } from "@/components/public-footer"

export function PublicArticle({
  title,
  description,
  path,
  children,
  parent,
}: {
  title: string
  description: string
  path: string
  children: ReactNode
  parent?: { name: string; path: string }
}) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-5 md:px-6">
        <SeoBreadcrumbs
          items={[
            { name: "Discover", path: "/" },
            ...(parent ? [parent] : []),
            { name: title, path },
          ]}
        />
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </header>
        <div className="space-y-6 text-sm leading-7 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_p+p]:mt-3 [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5">
          {children}
        </div>
      </main>
      <PublicFooter />
    </>
  )
}
