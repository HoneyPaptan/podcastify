"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Globe, Play, Volume2 } from "lucide-react"
import { useLingo } from "@/lib/lingo"
import { cn } from "@/lib/utils"

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

interface ChapterCardProps {
  chapter: Chapter
  translations: Record<string, ChapterTranslation>
  onTranslate: (chapterId: string, language: string) => Promise<void>
  onGenerateAudio?: (chapterId: string, language: string, text: string) => Promise<string>
  initialAudioUrls?: Record<string, string>
}

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
]

export function ChapterCard({ chapter, translations, onTranslate, onGenerateAudio, initialAudioUrls = {} }: ChapterCardProps) {
  const { t } = useLingo()
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [isTranslating, setIsTranslating] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>(initialAudioUrls)
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(initialAudioUrls["en"] || null)

  const handleLanguageSelect = async (langCode: string) => {
    if (langCode === selectedLanguage) return
    
    setSelectedLanguage(langCode)
    
    if (!translations[langCode] && langCode !== "en") {
      setIsTranslating(true)
      try {
        await onTranslate(chapter.id, langCode)
      } catch (error) {
        console.error("Translation failed:", error)
      } finally {
        setIsTranslating(false)
      }
    }
  }

  const displayContent = selectedLanguage === "en" 
    ? { title: chapter.title, textContent: chapter.textContent }
    : translations[selectedLanguage] || { title: chapter.title, textContent: chapter.textContent }

  const handleGenerateAudio = async () => {
    if (!onGenerateAudio) return
    
    const cachedUrl = audioUrls[selectedLanguage]
    if (cachedUrl) {
      setCurrentAudioUrl(cachedUrl)
      return
    }

    setIsGeneratingAudio(true)
    try {
      const audioUrl = await onGenerateAudio(chapter.id, selectedLanguage, displayContent.textContent)
      if (audioUrl) {
        setAudioUrls((prev) => ({ ...prev, [selectedLanguage]: audioUrl }))
        setCurrentAudioUrl(audioUrl)
      }
    } catch (error) {
      console.error("Audio generation failed:", error)
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  useEffect(() => {
    if (initialAudioUrls && Object.keys(initialAudioUrls).length > 0) {
      setAudioUrls((prev) => ({ ...prev, ...initialAudioUrls }))
      if (initialAudioUrls[selectedLanguage]) {
        setCurrentAudioUrl(initialAudioUrls[selectedLanguage])
      }
    }
  }, [initialAudioUrls, selectedLanguage])

  useEffect(() => {
    const url = audioUrls[selectedLanguage]
    if (url) {
      setCurrentAudioUrl(url)
    } else {
      setCurrentAudioUrl(null)
    }
  }, [selectedLanguage, audioUrls])

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl">{displayContent.title}</CardTitle>
            <CardDescription className="mt-2">
              {chapter.wordCount} words
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => {
              const hasTranslation = lang.code === "en" || !!translations[lang.code]
              const isSelected = selectedLanguage === lang.code
              
              return (
                <Button
                  key={lang.code}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleLanguageSelect(lang.code)}
                  disabled={isTranslating}
                  className="h-8 text-xs"
                >
                  {lang.flag} {lang.name}
                </Button>
              )
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isTranslating ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Translating...</p>
          </div>
        ) : (
          <>
            <div className="prose prose-sm max-w-none dark:prose-invert mb-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {displayContent.textContent}
              </p>
            </div>
            
            <div className="flex items-center gap-2 pt-4 border-t">
              <Button
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Audio...
                  </>
                ) : audioUrls[selectedLanguage] ? (
                  <>
                    <Play className="h-4 w-4" />
                    Play Audio
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4" />
                    Generate Audio
                  </>
                )}
              </Button>
              
              {currentAudioUrl && (
                <div className="flex-1">
                  <audio
                    controls
                    className="w-full h-10"
                    src={currentAudioUrl}
                    key={`${chapter.id}-${selectedLanguage}-${currentAudioUrl}`}
                    preload="metadata"
                    onError={(e) => {
                      const audioElement = e.currentTarget
                      const error = audioElement.error
                      console.error("Audio playback error:", {
                        url: currentAudioUrl,
                        errorCode: error?.code,
                        errorMessage: error?.message,
                        networkState: audioElement.networkState,
                        readyState: audioElement.readyState,
                      })
                      
                      if (error) {
                        switch (error.code) {
                          case error.MEDIA_ERR_ABORTED:
                            console.error("Audio loading aborted")
                            break
                          case error.MEDIA_ERR_NETWORK:
                            console.error("Network error while loading audio - check if file exists at:", currentAudioUrl)
                            break
                          case error.MEDIA_ERR_DECODE:
                            console.error("Audio decoding error - file may be corrupted or unsupported format. Try regenerating the audio.")
                            break
                          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                            console.error("Audio format not supported by browser")
                            break
                          default:
                            console.error("Unknown audio error")
                        }
                      }
                    }}
                    onLoadedMetadata={(e) => {
                      const audioElement = e.currentTarget
                      console.log(`[Audio] Loaded metadata successfully:`, {
                        url: currentAudioUrl,
                        duration: audioElement.duration,
                        readyState: audioElement.readyState,
                      })
                    }}
                    onCanPlay={(e) => {
                      const audioElement = e.currentTarget
                      console.log(`[Audio] Ready to play:`, {
                        url: currentAudioUrl,
                        duration: audioElement.duration,
                      })
                    }}
                    onLoadStart={() => {
                      console.log(`[Audio] Load started for ${currentAudioUrl}`)
                    }}
                    onStalled={() => {
                      console.warn(`[Audio] Load stalled for ${currentAudioUrl}`)
                    }}
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

