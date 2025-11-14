"use client"

import { Loader2 } from "lucide-react"
import { useLingo } from "@/lib/lingo"

export function TranslationLoader() {
  const { isLoading } = useLingo()

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md pointer-events-auto">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full border-2 border-primary opacity-20" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-base font-semibold text-foreground">Translating page</p>
          <p className="text-sm text-muted-foreground">Please wait while we translate the content...</p>
        </div>
      </div>
    </div>
  )
}

