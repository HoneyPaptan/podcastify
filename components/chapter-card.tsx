"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Globe } from "lucide-react"
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
}

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
]

export function ChapterCard({ chapter, translations, onTranslate }: ChapterCardProps) {
  const { t } = useLingo()
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [isTranslating, setIsTranslating] = useState(false)

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
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {displayContent.textContent}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

