"use client"

import { useState, useEffect } from "react"
import { useLingo } from "@/lib/lingo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { clearAllUICache } from "@/lib/cache"
import { Trash2, RefreshCw, Database } from "lucide-react"

export function TranslationDebug() {
  const { t, locale, isLoading, cacheHit, clearCache } = useLingo()
  const [lastAction, setLastAction] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleClearCache = () => {
    clearCache()
    setLastAction(`Cleared cache for ${locale}`)
  }

  const handleClearAllCache = () => {
    clearAllUICache()
    setLastAction("Cleared all UI translation cache")
  }

  const handleForceReTranslation = () => {
    clearCache()
    setLastAction(`Forced re-translation for ${locale}`)
  }

  // Don't render until mounted to prevent SSR hydration issues
  if (!mounted) {
    return null
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-background/95 backdrop-blur-sm border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" />
          Translation Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Locale:</span>
          <Badge variant="outline">{locale}</Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={isLoading ? "secondary" : cacheHit ? "default" : "destructive"}>
            {isLoading ? "Loading..." : cacheHit ? "Cache Hit" : "API Call"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Sample:</span>
          <span className="text-xs text-muted-foreground">
            {t("Generate Podcast") || "Generate Podcast"}
          </span>
        </div>

        {lastAction && (
          <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
            {lastAction}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClearCache}
            className="w-full"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Clear Current Cache
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleForceReTranslation}
            className="w-full"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Force Re-translation
          </Button>
          
          <Button
            size="sm"
            variant="destructive"
            onClick={handleClearAllCache}
            className="w-full"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All Cache
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}