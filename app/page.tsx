"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useLingo } from "@/lib/lingo"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Loader2, Link as LinkIcon } from "lucide-react"

export default function Home() {
  const { t } = useLingo()
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError(t("Please enter a valid URL"))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const urlPattern = /^https?:\/\/.+\..+/
      if (!urlPattern.test(url.trim())) {
        throw new Error(t("Invalid URL format"))
      }

      // TODO: Implement API call to scrape and process
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (err) {
      setError(err instanceof Error ? err.message : t("An error occurred"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4 py-12">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-2xl space-y-8">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("Multilingual Podcast Generator")}
          </h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            {t("Turn any blog into a multilingual podcast in seconds")}
          </p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">{t("Enter Blog URL")}</CardTitle>
            <CardDescription>
              {t("Paste any blog URL to extract content and generate multilingual podcast audio")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder={t("https://example.com/blog-post")}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
                <Button type="submit" disabled={isLoading} size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("Processing...")}
                    </>
                  ) : (
                    t("Generate Podcast")
                  )}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </form>
          </CardContent>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
