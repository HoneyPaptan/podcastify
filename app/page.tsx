"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useLingo } from "@/lib/lingo"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import LightRays from "@/components/LightRays"
import PrismaticBurst from "@/components/PrismaticBurst"
import { LoadingScreen } from "@/components/loading-screen"
import { ProcessingStatus } from "@/components/processing-status"
import { ChapterCard } from "@/components/chapter-card"
import { PodcastFlow } from "@/components/podcast-flow"
import { TranslationDebug } from "@/components/translation-debug"
import { Loader2, Link as LinkIcon, Sparkles, ArrowRight } from "lucide-react"
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
  const [chapterCount, setChapterCount] = useState("3")
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
    setChapterCount("3")
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
    const numChapters = parseInt(chapterCount) || 3
    const cachedChapters = getCachedChapters(normalizedUrl, numChapters)
    
    if (cachedChapters && cachedChapters.length > 0) {
      console.log(`[Cache] Using cached chapters for ${normalizedUrl} with ${numChapters} chapters`)
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
      { id: "summarize", label: `Summarizing to ${numChapters} chapters`, status: "pending" },
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
        toast.error(errorData.error || "Failed to scrape blog", { id: "scrape" })
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
        toast.error(errorData.error || "Failed to generate chapters", { id: "chapters" })
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
          targetChapters: parseInt(chapterCount) || 3,
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

      setCachedChapters(normalizedUrl, numChapters, summarizedData.chapters)
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
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      {isLoading && chapters.length === 0 ? (
        <div className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden">
          {/* Prismatic Burst Background */}
          <div className="fixed inset-0 z-0 w-full h-full">
            <PrismaticBurst />
          </div>
          <LoadingScreen steps={steps} />
        </div>
      ) : !isLoading && chapters.length === 0 && !getCurrentSession() ? (
        <div className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden">
          {/* Light Rays Background */}
          <div className="fixed inset-0 z-0">
            <LightRays className="w-full h-full" />
          </div>
          <div className="relative z-10 w-full max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title and Paragraph */}
              <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  {t("Multilingual Podcast Generator")}
                </h1>
                <p className="text-sm text-muted-foreground sm:text-base">
                  {t("Turn any blog into a multilingual podcast in seconds")}
                </p>
              </div>

              {/* Input and Submit */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder={t("https://example.com/blog-post")}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                    className="h-12 pl-10 text-base"
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={chapterCount} onValueChange={setChapterCount} disabled={isLoading}>
                        <SelectTrigger className="h-12 w-20 px-3 py-0 [&[data-size=default]]:!h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("Select chapters")}</p>
                  </TooltipContent>
                </Tooltip>
                <Button 
                  type="submit" 
                  disabled={isLoading || !url.trim()} 
                  className="h-12 w-12 p-0 shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </form>
            {error && (
              <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="fixed inset-0 w-screen h-screen">
            <PodcastFlow
              steps={steps}
              chapters={chapters}
              translations={translations}
              audioUrls={audioUrlsState}
              onTranslate={handleTranslateChapter}
              onGenerateAudio={handleGenerateAudio}
              isLoading={isLoading}
              onStartNew={handleStartNew}
            />
            {process.env.NODE_ENV === 'development' && <TranslationDebug />}
          </div>
        </>
      )}
    </>
  )
}
