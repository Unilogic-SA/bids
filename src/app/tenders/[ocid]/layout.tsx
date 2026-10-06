import { Toaster } from "@/components/ui/sonner"

export default function TenderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <Toaster position="bottom-center" duration={2000} visibleToasts={1} />
    </>
  )
}
