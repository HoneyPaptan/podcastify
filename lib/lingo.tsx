"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react"
import { getCachedUITranslations, setCachedUITranslations, invalidateUITranslationCache } from "@/lib/cache"
import { hasComponentsChanged, updateComponentHash, hasTranslationVersionChanged, updateTranslationVersion, generateComponentHash } from "@/lib/component-tracker"
import { TRANSLATION_CONFIG, debugLog, logPerformance } from "@/config/translation-config"

interface LingoContextType {
  locale: string
  setLocale: (locale: string) => void
  t: (key: string, params?: Record<string, string>) => string
  isLoading: boolean
  clearCache: () => void
  cacheHit: boolean
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

async function translateBatch(texts: string[], targetLocale: string, sourceLocale: string = "en"): Promise<string[]> {
  if (targetLocale === sourceLocale) {
    return texts
  }
  
  // Check cache first and only request uncached items
  const uncachedTexts: string[] = []
  const uncachedIndices: number[] = []
  const results: string[] = [...texts]
  
  texts.forEach((text, index) => {
    const cacheKey = `${sourceLocale}-${targetLocale}-${text}`
    if (translationCache.has(cacheKey)) {
      results[index] = translationCache.get(cacheKey)!
    } else {
      uncachedTexts.push(text)
      uncachedIndices.push(index)
    }
  })
  
  if (uncachedTexts.length === 0) {
    return results
  }
  
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts: uncachedTexts,
        targetLocale,
        sourceLocale,
      }),
    })
    
    if (!response.ok) {
      throw new Error("Batch translation request failed")
    }
    
    const data = await response.json()
    const translatedTexts = data.translated || uncachedTexts
    
    // Update results and cache
    uncachedIndices.forEach((originalIndex, batchIndex) => {
      const translated = translatedTexts[batchIndex] || uncachedTexts[batchIndex]
      results[originalIndex] = translated
      
      if (translated && translated !== uncachedTexts[batchIndex]) {
        const cacheKey = `${sourceLocale}-${targetLocale}-${uncachedTexts[batchIndex]}`
        translationCache.set(cacheKey, translated)
      }
    })
    
    return results
  } catch (error) {
    console.warn("Batch translation error:", error)
    return texts
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
  "AI-Powered Podcast Generation",
  "Multilingual",
  "Support for 18+ languages",
  "Fast",
  "Generate in seconds",
  "High Quality",
  "Studio-grade audio",
  
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
  const [mounted, setMounted] = useState(false)
  const [cacheHit, setCacheHit] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedLocale = localStorage.getItem("lingo-locale")
    if (savedLocale) {
      setLocale(savedLocale)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("lingo-locale", locale)
      document.documentElement.lang = locale
    }
  }, [locale, mounted])

  useEffect(() => {
    if (!mounted || locale === "en") {
      setTranslations({})
      setIsLoading(false)
      setCacheHit(false)
      return
    }

    setIsLoading(true)
    setCacheHit(false)
    
    const translateAll = async () => {
      const startTime = performance.now()
      
      try {
        // Check for component changes and version changes
        const componentsChanged = hasComponentsChanged(UI_KEYS)
        const versionChanged = hasTranslationVersionChanged()
        
        debugLog('Translation checks', { 
          locale, 
          componentsChanged, 
          versionChanged 
        })
        
        // Try to load from cache first
        const cachedTranslations = getCachedUITranslations(locale)
        
        if (cachedTranslations && !componentsChanged && !versionChanged) {
          debugLog('Loading translations from cache', { 
            locale, 
            keyCount: cachedTranslations.keyCount 
          })
          
          setTranslations(cachedTranslations.translations)
          setCacheHit(true)
          setIsLoading(false)
          
          logPerformance('Cache hit', performance.now() - startTime)
          return
        }
        
        // Cache miss or invalid - need API call
        debugLog('Cache miss or invalid, fetching from API', { 
          locale,
          cachedTranslations: !!cachedTranslations,
          componentsChanged,
          versionChanged
        })
        
        const translatedTexts = await translateBatch(UI_KEYS, locale, "en")
        const translated: Record<string, string> = {}
        
        UI_KEYS.forEach((key, index) => {
          translated[key] = translatedTexts[index] || key
        })
        
        // Save to cache with component hashes
        const componentHashes = {
          ui_keys: generateComponentHash(UI_KEYS),
          version: TRANSLATION_CONFIG.TRANSLATION_VERSION
        }
        
        setCachedUITranslations(locale, translated, componentHashes, TRANSLATION_CONFIG.TRANSLATION_VERSION)
        updateComponentHash(UI_KEYS)
        updateTranslationVersion()
        
        setTranslations(translated)
        setCacheHit(false)
        
        logPerformance('API translation', performance.now() - startTime)
        
      } catch (error) {
        console.warn("Translation failed, attempting fallback:", error)
        
        // Try to use stale cache if available
        const staleCache = getCachedUITranslations(locale)
        if (staleCache && TRANSLATION_CONFIG.FALLBACK_TO_API) {
          debugLog('Using stale cache as fallback', { locale })
          setTranslations(staleCache.translations)
          setCacheHit(true) // Mark as hit since we're using cache
        } else {
          // Final fallback to individual translations
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
          setCacheHit(false)
        }
      }
      
      setIsLoading(false)
    }

    translateAll()
  }, [locale, mounted])

const t = useCallback((key: string, params?: Record<string, string>): string => {
    let result = key
    
    // Only use translations on client-side after mounting and when locale is not English
    if (mounted && locale !== "en" && translations[key]) {
      result = translations[key]
    }
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        result = result.replace(`{{${paramKey}}}`, value)
        result = result.replace(`{${paramKey}}}`, value)
      })
    }
    
    return result
  }, [locale, translations, mounted])

  const clearCache = useCallback(() => {
    invalidateUITranslationCache(locale)
    setTranslations({})
    setCacheHit(false)
    debugLog('Cache cleared manually', { locale })
  }, [locale])

  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
    isLoading,
    clearCache,
    cacheHit,
  }), [locale, t, isLoading, mounted, clearCache, cacheHit])

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
