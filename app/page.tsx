"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useLingo } from "@/lib/lingo"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ProcessingStatus } from "@/components/processing-status"
import { ChapterCard } from "@/components/chapter-card"
import { Loader2, Link as LinkIcon } from "lucide-react"
import {
  getCachedChapters,
  setCachedChapters,
  getCachedTranslation,
  setCachedTranslation,
  getCachedAudio,
  setCachedAudio,
  getAllCachedTranslations,
  getAllCachedAudios,
} from "@/lib/cache"

type StepStatus = "pending" | "processing" | "completed" | "error"

interface ProcessingStep {
  id: string
  label: string
  status: StepStatus
}

interface Chapter {
  id: string
  title: string
  content: string
  textContent: string
  wordCount: number
}

interface ChapterTranslation {
  title: string
  textContent: string
}

export default function Home() {
  const { t } = useLingo()
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [translations, setTranslations] = useState<Record<string, Record<string, ChapterTranslation>>>({})
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: "scrape", label: "Scraping blog content", status: "pending" },
    { id: "chapters", label: "Generating chapters", status: "pending" },
    { id: "summarize", label: "Summarizing to 3 chapters", status: "pending" },
  ])

  const updateStep = (stepId: string, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    )
  }

  const handleTranslateChapter = async (chapterId: string, language: string) => {
    const chapter = chapters.find((ch) => ch.id === chapterId)
    if (!chapter) return

    if (translations[chapterId]?.[language]) {
      return
    }

    const cachedTranslation = getCachedTranslation(chapterId, language)
    if (cachedTranslation) {
      console.log(`[Cache] Using cached translation for chapter ${chapterId} in ${language}`)
      setTranslations((prev) => ({
        ...prev,
        [chapterId]: {
          ...prev[chapterId],
          [language]: cachedTranslation,
        },
      }))
      return
    }

    try {
      const response = await fetch("/api/translate-chapter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chapter,
          targetLocale: language,
          sourceLocale: "en",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Translation failed")
      }

      const data = await response.json()
      const translation = data.translations[language]
      
      if (translation) {
        setCachedTranslation(chapterId, language, translation)
        setTranslations((prev) => ({
          ...prev,
          [chapterId]: {
            ...prev[chapterId],
            [language]: translation,
          },
        }))
      }
    } catch (error) {
      console.error("Translation error:", error)
      throw error
    }
  }

  const handleGenerateAudio = async (chapterId: string, language: string, text: string): Promise<string> => {
    const cachedAudio = getCachedAudio(chapterId, language)
    if (cachedAudio) {
      console.log(`[Cache] Using cached audio for chapter ${chapterId} in ${language}`)
      return cachedAudio
    }

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          language,
          chapterId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Audio generation failed")
      }

      const data = await response.json()
      setCachedAudio(chapterId, language, data.audioUrl)
      return data.audioUrl
    } catch (error) {
      console.error("Audio generation error:", error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError(t("Please enter a valid URL"))
      return
    }

    const normalizedUrl = url.trim().toLowerCase()
    const cachedChapters = getCachedChapters(normalizedUrl)
    
    if (cachedChapters && cachedChapters.length > 0) {
      console.log(`[Cache] Using cached chapters for ${normalizedUrl}`)
      setChapters(cachedChapters)
      const chapterIds = cachedChapters.map((ch: Chapter) => ch.id)
      setTranslations(getAllCachedTranslations(chapterIds))
      return
    }

    setIsLoading(true)
    setError(null)
    setSteps([
      { id: "scrape", label: "Scraping blog content", status: "pending" },
      { id: "chapters", label: "Generating chapters", status: "pending" },
      { id: "summarize", label: "Summarizing to 3 chapters", status: "pending" },
    ])

    try {
      const urlPattern = /^https?:\/\/.+\..+/
      if (!urlPattern.test(normalizedUrl)) {
        throw new Error(t("Invalid URL format"))
      }

      console.log("[Step 1/3] Starting scrape...")
      updateStep("scrape", "processing")
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: normalizedUrl }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        updateStep("scrape", "error")
        throw new Error(errorData.error || t("An error occurred"))
      }

      const scrapedData = await response.json()
      console.log("[Step 1/3] Scrape completed:", scrapedData)
      updateStep("scrape", "completed")

      console.log("[Step 2/3] Starting chapter generation...")
      updateStep("chapters", "processing")
      const chaptersResponse = await fetch("/api/chapters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: scrapedData.content,
          textContent: scrapedData.textContent,
        }),
      })

      if (!chaptersResponse.ok) {
        const errorData = await chaptersResponse.json()
        updateStep("chapters", "error")
        throw new Error(errorData.error || t("Failed to generate chapters"))
      }

      const chaptersData = await chaptersResponse.json()
      console.log("[Step 2/3] Chapters generated:", chaptersData)
      console.log(`[Step 2/3] Total chapters: ${chaptersData.totalChapters}, Total words: ${chaptersData.totalWords}`)
      updateStep("chapters", "completed")

      console.log("[Step 3/3] Starting summarization...")
      updateStep("summarize", "processing")
      
      const summarizeResponse = await fetch("/api/summarize-chapters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chapters: chaptersData.chapters,
          targetChapters: 3,
        }),
      })

      if (!summarizeResponse.ok) {
        const errorData = await summarizeResponse.json()
        updateStep("summarize", "error")
        console.error("[Step 3/3] Summarization failed:", errorData)
        throw new Error(errorData.error || t("Failed to summarize chapters"))
      }

      const summarizedData = await summarizeResponse.json()
      console.log("[Step 3/3] Summarization completed:", summarizedData)
      console.log(`[Step 3/3] Reduced from ${summarizedData.originalChapters} to ${summarizedData.totalChapters} chapters`)
      console.log(`[Step 3/3] Word count: ${summarizedData.originalWords} → ${summarizedData.totalWords}`)
      updateStep("summarize", "completed")

      setCachedChapters(normalizedUrl, summarizedData.chapters)
      setChapters(summarizedData.chapters)
      
      const chapterIds = summarizedData.chapters.map((ch: Chapter) => ch.id)
      setTranslations(getAllCachedTranslations(chapterIds))
    } catch (err) {
      console.error("Error in processing:", err)
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

        {isLoading && <ProcessingStatus steps={steps} />}

        {chapters.length > 0 && !isLoading && (
          <div className="w-full max-w-4xl space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Generated Chapters</h2>
              <p className="text-muted-foreground">
                Click on language buttons to translate each chapter on-demand
              </p>
            </div>
            {chapters.map((chapter) => {
              const cachedAudios = getAllCachedAudios(chapters.map((ch: Chapter) => ch.id))
              const chapterAudios = cachedAudios[chapter.id] || {}
              
              if (Object.keys(chapterAudios).length > 0) {
                console.log(`[Cache] Loaded ${Object.keys(chapterAudios).length} cached audio URLs for chapter ${chapter.id}`)
              }
              
              return (
                <ChapterCard
                  key={chapter.id}
                  chapter={chapter}
                  translations={translations[chapter.id] || {}}
                  onTranslate={handleTranslateChapter}
                  onGenerateAudio={handleGenerateAudio}
                  initialAudioUrls={chapterAudios}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
