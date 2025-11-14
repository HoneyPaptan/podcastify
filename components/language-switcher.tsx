"use client"

import { Button } from "@/components/ui/button"
import { useLingo } from "@/lib/lingo"
import { Globe } from "lucide-react"

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
]

export function LanguageSwitcher() {
  const { locale, setLocale, isLoading } = useLingo()

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-1 rounded-md border border-input bg-background p-1">
        {languages.map((lang) => (
          <Button
            key={lang.code}
            variant={locale === lang.code ? "default" : "ghost"}
            size="sm"
            onClick={() => setLocale(lang.code)}
            disabled={isLoading}
            className="h-7 px-3 text-xs"
          >
            {lang.name}
          </Button>
        ))}
      </div>
    </div>
  )
}

