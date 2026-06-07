"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

type ListingResultCountProps = {
  isFiltered: boolean
  totalCount: number
}

export function ListingResultCount({
  isFiltered,
  totalCount,
}: ListingResultCountProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const initialScrollY = useRef(0)
  const label = isFiltered ? "Filtered open tenders" : "Open tenders"

  useEffect(() => {
    let frame = 0
    initialScrollY.current = window.scrollY

    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > initialScrollY.current + 12)
      })
    }

    update()
    window.addEventListener("scroll", update, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", update)
    }
  }, [])

  return (
    <p
      className={cn(
        "overflow-hidden text-sm font-medium text-muted-foreground transition-[max-height,opacity,transform,margin] duration-200",
        isScrolled
          ? "-mb-4 max-h-0 -translate-y-1 opacity-0"
          : "max-h-6 translate-y-0 opacity-100"
      )}
    >
      <span className="text-foreground">
        {totalCount.toLocaleString("en-ZA")}
      </span>{" "}
      {label}
    </p>
  )
}
