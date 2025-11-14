"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react"

interface LingoContextType {
  locale: string
  setLocale: (locale: string) => void
  t: (key: string, params?: Record<string, string>) => string
  isLoading: boolean
}

const LingoContext = createContext<LingoContextType | undefined>(undefined)

const translationCache: Map<string, string> = new Map()

async function translateText(text: string, targetLocale: string, sourceLocale: string = "en"): Promise<string> {
  if (targetLocale === sourceLocale) {
    return text
  }
  
  const cacheKey = `${sourceLocale}-${targetLocale}-${text}`
  
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!
  }
  
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        targetLocale,
        sourceLocale,
      }),
    })
    
    if (!response.ok) {
      throw new Error("Translation request failed")
    }
    
    const data = await response.json()
    const translated = data.translated || text
    
    if (translated && translated !== text) {
      translationCache.set(cacheKey, translated)
      return translated
    }
    
    return text
  } catch (error) {
    console.warn("Translation error:", error)
    return text
  }
}

const UI_KEYS = [
  // Home page
  "Multilingual Podcast Generator",
  "Turn any blog into a multilingual podcast in seconds",
  "Enter Blog URL",
  "Paste any blog URL to extract content and generate multilingual podcast audio",
  "https://example.com/blog-post",
  "Generate Podcast",
  "Processing...",
  "Please enter a valid URL",
  "Invalid URL format",
  "An error occurred",
  
  // Canvas UI
  "Podcastify",
  "Blog to Podcast Converter",
  "Start New Podcast",
  "LEGEND",
  "Chapter Node",
  "Audio Node",
  "Merge Group",
  "View Content",
  "Audio Available",
  "Translating...",
  "Generate Audio",
  "Generating...",
  "Audio Ready",
  "Download Audio",
  "Download Merged",
  "Download All",
  "Download started!",
  "Preparing download...",
  "Failed to download audio files",
  "Please select at least one audio to download",
  "words",
  "Language:",
  "Audio",
  "Chapter",
  "Select",
  "audios to merge",
  "audio",
  "audios",
  "selected",
  "Select audios with the same language to merge",
  "Create Merge Group",
  "Clear",
  "Audio download started!",
  "Merged audio download started!",
  "Failed to download merged audio",
  "Merging audio files...",
  "Please select at least 2 audio nodes to merge",
  "All selected audios must be in the same language",
  "Merge group created with",
  "Merge group removed",
  "Audio generated successfully!",
  "Failed to generate audio",
  "Generating",
  "audio...",
]

export function LingoProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState("en")
  const [isLoading, setIsLoading] = useState(false)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLocale = localStorage.getItem("lingo-locale")
      if (savedLocale) {
        setLocale(savedLocale)
      }
      setIsInitialized(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lingo-locale", locale)
      document.documentElement.lang = locale
    }
  }, [locale])

  useEffect(() => {
    if (!isInitialized || locale === "en") {
      setTranslations({})
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    
    const translateAll = async () => {
      const translated: Record<string, string> = {}
      
      for (const key of UI_KEYS) {
        try {
          const translatedText = await translateText(key, locale, "en")
          translated[key] = translatedText
        } catch (error) {
          translated[key] = key
        }
      }
      
      setTranslations(translated)
      setIsLoading(false)
    }

    translateAll()
  }, [locale, isInitialized])

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    let result = key
    
    if (locale !== "en" && translations[key]) {
      result = translations[key]
    }
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        result = result.replace(`{{${paramKey}}}`, value)
        result = result.replace(`{${paramKey}}`, value)
      })
    }
    
    return result
  }, [locale, translations])

  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
    isLoading,
  }), [locale, t, isLoading])

  return (
    <LingoContext.Provider value={value}>
      <div className={isLoading ? "pointer-events-none select-none" : ""}>
        {children}
      </div>
    </LingoContext.Provider>
  )
}

export function useLingo() {
  const context = useContext(LingoContext)
  if (context === undefined) {
    throw new Error("useLingo must be used within a LingoProvider")
  }
  return context
}
