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
import { PodcastFlow } from "@/components/podcast-flow"
import { JobsViewer } from "@/components/jobs-viewer"
import { Loader2, Link as LinkIcon } from "lucide-react"
import { toast } from "sonner"
import {
  getCachedChapters,
  setCachedChapters,
  getCachedTranslation,
  setCachedTranslation,
  getCachedAudio,
  setCachedAudio,
  getAllCachedTranslations,
  getAllCachedAudios,
  saveCurrentSession,
  getCurrentSession,
  clearCurrentSession,
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
  const [audioUrlsState, setAudioUrlsState] = useState<Record<string, Record<string, string>>>({})
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: "scrape", label: "Scraping blog content", status: "pending" },
    { id: "chapters", label: "Generating chapters", status: "pending" },
    { id: "summarize", label: "Summarizing to 3 chapters", status: "pending" },
  ])

  // Restore session on mount
  useEffect(() => {
    const session = getCurrentSession()
    if (session) {
      console.log("[Session] Restoring previous session:", session.url)
      setUrl(session.url)
      setChapters(session.chapters)
      setTranslations(session.translations)
      setAudioUrlsState(session.audioUrls)
      toast.success("Restored previous session")
    }
  }, [])

  // Save session whenever chapters/translations/audio changes
  useEffect(() => {
    if (chapters.length > 0) {
      saveCurrentSession(url, chapters, translations, audioUrlsState)
    }
  }, [chapters, translations, audioUrlsState, url])

  const updateStep = (stepId: string, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    )
  }

  const handleStartNew = () => {
    clearCurrentSession()
    setUrl("")
    setChapters([])
    setTranslations({})
    setAudioUrlsState({})
    setError(null)
    setSteps([
      { id: "scrape", label: "Scraping blog content", status: "pending" },
      { id: "chapters", label: "Generating chapters", status: "pending" },
      { id: "summarize", label: "Summarizing to 3 chapters", status: "pending" },
    ])
    toast.success("Started new session")
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
      setAudioUrlsState((prev) => ({
        ...prev,
        [chapterId]: {
          ...prev[chapterId],
          [language]: cachedAudio,
        },
      }))
      return cachedAudio
    }

    try {
      // Trigger background job via Inngest
      const response = await fetch("/api/tts-async", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          language,
          chapterId,
          sessionId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Audio generation failed")
      }

      const data = await response.json()
      
      // If cached, return immediately
      if (data.cached && data.audioUrl) {
        setCachedAudio(chapterId, language, data.audioUrl)
        setAudioUrlsState((prev) => ({
          ...prev,
          [chapterId]: {
            ...prev[chapterId],
            [language]: data.audioUrl,
          },
        }))
        return data.audioUrl
      }

      // Background job triggered - poll for completion
      const jobId = data.jobId
      console.log(`[Background] Audio generation job started: ${jobId}`)
      toast.info(`Audio generation started in background for ${language}`)

      // Poll for job completion
      const pollInterval = 2000 // 2 seconds
      const maxAttempts = 60 // Max 2 minutes
      let attempts = 0

      const pollJob = async (): Promise<string> => {
        if (attempts >= maxAttempts) {
          throw new Error("Audio generation timeout")
        }

        attempts++
        const jobResponse = await fetch(`/api/jobs?jobId=${jobId}`)
        
        if (!jobResponse.ok) {
          throw new Error("Failed to fetch job status")
        }

        const jobData = await jobResponse.json()
        const job = jobData.job

        if (job.status === "completed" && job.audioUrl) {
          console.log(`[Background] Audio generation completed: ${job.audioUrl}`)
          setCachedAudio(chapterId, language, job.audioUrl)
          setAudioUrlsState((prev) => ({
            ...prev,
            [chapterId]: {
              ...prev[chapterId],
              [language]: job.audioUrl,
            },
          }))
          toast.success(`Audio ready for ${language}`)
          return job.audioUrl
        } else if (job.status === "failed") {
          throw new Error(job.error || "Audio generation failed")
        } else {
          // Still processing, poll again
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
          return pollJob()
        }
      }

      return await pollJob()
    } catch (error) {
      console.error("Audio generation error:", error)
      toast.error(`Failed to generate audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      setAudioUrlsState(getAllCachedAudios(chapterIds))
      toast.success("Loaded from cache")
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
      toast.loading("Scraping blog content...", { id: "scrape" })
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
        toast.error(errorData.error || "Failed to scrape blog", { id: "scrape" })
        throw new Error(errorData.error || t("An error occurred"))
      }

      const scrapedData = await response.json()
      console.log("[Step 1/3] Scrape completed:", scrapedData)
      updateStep("scrape", "completed")
      toast.success("Blog content scraped", { id: "scrape" })

      console.log("[Step 2/3] Starting chapter generation...")
      updateStep("chapters", "processing")
      toast.loading("Generating chapters...", { id: "chapters" })
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
        toast.error(errorData.error || "Failed to generate chapters", { id: "chapters" })
        throw new Error(errorData.error || t("Failed to generate chapters"))
      }

      const chaptersData = await chaptersResponse.json()
      console.log("[Step 2/3] Chapters generated:", chaptersData)
      console.log(`[Step 2/3] Total chapters: ${chaptersData.totalChapters}, Total words: ${chaptersData.totalWords}`)
      updateStep("chapters", "completed")
      toast.success("Chapters generated", { id: "chapters" })

      console.log("[Step 3/3] Starting summarization...")
      updateStep("summarize", "processing")
      toast.loading("Summarizing to 3 chapters...", { id: "summarize" })
      
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
        toast.error(errorData.error || "Failed to summarize chapters", { id: "summarize" })
        throw new Error(errorData.error || t("Failed to summarize chapters"))
      }

      const summarizedData = await summarizeResponse.json()
      console.log("[Step 3/3] Summarization completed:", summarizedData)
      console.log(`[Step 3/3] Reduced from ${summarizedData.originalChapters} to ${summarizedData.totalChapters} chapters`)
      console.log(`[Step 3/3] Word count: ${summarizedData.originalWords} → ${summarizedData.totalWords}`)
      updateStep("summarize", "completed")
      toast.success("Podcast ready!", { id: "summarize" })

      setCachedChapters(normalizedUrl, summarizedData.chapters)
      setChapters(summarizedData.chapters)
      
      const chapterIds = summarizedData.chapters.map((ch: Chapter) => ch.id)
      setTranslations(getAllCachedTranslations(chapterIds))
      setAudioUrlsState(getAllCachedAudios(chapterIds))
      
      setTimeout(() => {
        setSteps([])
      }, 500)
    } catch (err) {
      console.error("Error in processing:", err)
      setError(err instanceof Error ? err.message : t("An error occurred"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      {!isLoading && chapters.length === 0 ? (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4 py-12">
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
          </div>
        </div>
      ) : (
        <>
          {/* Start New Button */}
          <div className="absolute top-4 left-4 z-50">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartNew}
              className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            >
              {t("Start New Podcast")}
            </Button>
          </div>
          
          <div className="fixed inset-0 w-screen h-screen">
            <PodcastFlow
              steps={steps}
              chapters={chapters}
              translations={translations}
              audioUrls={audioUrlsState}
              onTranslate={handleTranslateChapter}
              onGenerateAudio={handleGenerateAudio}
              isLoading={isLoading}
            />
          </div>
        </>
      )}
      
      {/* Background Jobs Viewer */}
      {chapters.length > 0 && <JobsViewer sessionId={sessionId} />}
    </>
  )
}
