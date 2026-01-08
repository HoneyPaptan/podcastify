interface CachedChapters {
  url: string
  chapterCount: number
  chapters: any[]
  timestamp: number
}

interface CachedTranslation {
  chapterId: string
  language: string
  translation: {
    title: string
    textContent: string
  }
}

interface CachedAudio {
  chapterId: string
  language: string
  audioUrl: string
}

const CACHE_KEYS = {
  CHAPTERS: "podcastify_chapters",
  TRANSLATIONS: "podcastify_translations",
  AUDIOS: "podcastify_audios",
  CURRENT_SESSION: "podcastify_current_session",
  UI_TRANSLATIONS: "podcastify_ui_translations",
  COMPONENT_HASHES: "podcastify_component_hashes",
  TRANSLATION_VERSION: "podcastify_translation_version",
}

export function getCachedChapters(url: string, chapterCount: number): any[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.CHAPTERS)
    if (!cached) return null

    const data: CachedChapters = JSON.parse(cached)
    if (data.url === url && data.chapterCount === chapterCount && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
      return data.chapters
    }
    return null
  } catch {
    return null
  }
}

export function setCachedChapters(url: string, chapterCount: number, chapters: any[]): void {
  try {
    const data: CachedChapters = {
      url,
      chapterCount,
      chapters,
      timestamp: Date.now(),
    }
    localStorage.setItem(CACHE_KEYS.CHAPTERS, JSON.stringify(data))
  } catch {
    // Ignore localStorage errors
  }
}

export function getCachedTranslation(chapterId: string, language: string): { title: string; textContent: string } | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.TRANSLATIONS)
    if (!cached) return null

    const translations: CachedTranslation[] = JSON.parse(cached)
    const found = translations.find(
      (t) => t.chapterId === chapterId && t.language === language
    )
    return found ? found.translation : null
  } catch {
    return null
  }
}

export function setCachedTranslation(
  chapterId: string,
  language: string,
  translation: { title: string; textContent: string }
): void {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.TRANSLATIONS)
    const translations: CachedTranslation[] = cached ? JSON.parse(cached) : []
    
    const index = translations.findIndex(
      (t) => t.chapterId === chapterId && t.language === language
    )

    const newTranslation: CachedTranslation = {
      chapterId,
      language,
      translation,
    }

    if (index >= 0) {
      translations[index] = newTranslation
    } else {
      translations.push(newTranslation)
    }

    localStorage.setItem(CACHE_KEYS.TRANSLATIONS, JSON.stringify(translations))
  } catch {
    // Ignore localStorage errors
  }
}

export function getCachedAudio(chapterId: string, language: string): string | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.AUDIOS)
    if (!cached) return null

    const audios: CachedAudio[] = JSON.parse(cached)
    const found = audios.find(
      (a) => a.chapterId === chapterId && a.language === language
    )
    return found ? found.audioUrl : null
  } catch {
    return null
  }
}

export function setCachedAudio(chapterId: string, language: string, audioUrl: string): void {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.AUDIOS)
    const audios: CachedAudio[] = cached ? JSON.parse(cached) : []
    
    const index = audios.findIndex(
      (a) => a.chapterId === chapterId && a.language === language
    )

    const newAudio: CachedAudio = {
      chapterId,
      language,
      audioUrl,
    }

    if (index >= 0) {
      audios[index] = newAudio
    } else {
      audios.push(newAudio)
    }

    localStorage.setItem(CACHE_KEYS.AUDIOS, JSON.stringify(audios))
  } catch {
    // Ignore localStorage errors
  }
}

export function getAllCachedTranslations(chapterIds: string[]): Record<string, Record<string, { title: string; textContent: string }>> {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.TRANSLATIONS)
    if (!cached) return {}

    const translations: CachedTranslation[] = JSON.parse(cached)
    const result: Record<string, Record<string, { title: string; textContent: string }>> = {}

    chapterIds.forEach((chapterId) => {
      result[chapterId] = {}
      translations
        .filter((t) => t.chapterId === chapterId)
        .forEach((t) => {
          result[chapterId][t.language] = t.translation
        })
    })

    return result
  } catch {
    return {}
  }
}

export function getAllCachedAudios(chapterIds: string[]): Record<string, Record<string, string>> {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.AUDIOS)
    if (!cached) return {}

    const audios: CachedAudio[] = JSON.parse(cached)
    const result: Record<string, Record<string, string>> = {}

    chapterIds.forEach((chapterId) => {
      result[chapterId] = {}
      audios
        .filter((a) => a.chapterId === chapterId)
        .forEach((a) => {
          result[chapterId][a.language] = a.audioUrl
        })
    })

    return result
  } catch {
    return {}
  }
}

// Session persistence - keeps current state across page reloads
interface CurrentSession {
  url: string
  chapters: any[]
  translations: Record<string, Record<string, { title: string; textContent: string }>>
  audioUrls: Record<string, Record<string, string>>
  timestamp: number
}

export function saveCurrentSession(
  url: string,
  chapters: any[],
  translations: Record<string, Record<string, { title: string; textContent: string }>>,
  audioUrls: Record<string, Record<string, string>>
): void {
  try {
    const session: CurrentSession = {
      url,
      chapters,
      translations,
      audioUrls,
      timestamp: Date.now(),
    }
    localStorage.setItem(CACHE_KEYS.CURRENT_SESSION, JSON.stringify(session))
  } catch {
    // Ignore localStorage errors
  }
}

export function getCurrentSession(): CurrentSession | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.CURRENT_SESSION)
    if (!cached) return null

    const session: CurrentSession = JSON.parse(cached)
    // Session expires after 7 days
    if (Date.now() - session.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return session
    }
    // Clear expired session
    clearCurrentSession()
    return null
  } catch {
    return null
  }
}

export function clearCurrentSession(): void {
  try {
    localStorage.removeItem(CACHE_KEYS.CURRENT_SESSION)
  } catch {
    // Ignore localStorage errors
  }
}

// UI Translation Caching
interface CachedUITranslation {
  locale: string
  translations: Record<string, string>
  componentHashes: Record<string, string>
  timestamp: number
  version: string
  keyCount: number
}

export function getCachedUITranslations(locale: string): CachedUITranslation | null {
  // Only access localStorage on client side
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const cached = localStorage.getItem(CACHE_KEYS.UI_TRANSLATIONS)
    if (!cached) return null

    const translations: Record<string, CachedUITranslation> = JSON.parse(cached)
    const cacheData = translations[locale]
    
    if (!cacheData) return null

    // Check if cache is expired (24 hours for UI translations)
    const isExpired = Date.now() - cacheData.timestamp > 24 * 60 * 60 * 1000
    
    if (isExpired) {
      debugLog('UI translation cache expired', { locale })
      invalidateUITranslationCache(locale)
      return null
    }

    debugLog('Found cached UI translations', { 
      locale, 
      keyCount: cacheData.keyCount,
      version: cacheData.version 
    })
    
    return cacheData
  } catch (error) {
    debugLog('Error reading UI translation cache:', error)
    return null
  }
}

export function setCachedUITranslations(
  locale: string,
  translations: Record<string, string>,
  componentHashes: Record<string, string>,
  version: string
): void {
  // Only access localStorage on client side
  if (typeof window === 'undefined') {
    return
  }

  try {
    const cached = localStorage.getItem(CACHE_KEYS.UI_TRANSLATIONS)
    const allTranslations: Record<string, CachedUITranslation> = cached ? JSON.parse(cached) : {}

    const cacheData: CachedUITranslation = {
      locale,
      translations,
      componentHashes,
      timestamp: Date.now(),
      version,
      keyCount: Object.keys(translations).length,
    }

    allTranslations[locale] = cacheData

    // Check cache size limit (5MB total)
    const cacheSize = JSON.stringify(allTranslations).length
    if (cacheSize > 5 * 1024 * 1024) {
      debugLog('Cache size limit exceeded, clearing old entries', { size: cacheSize })
      clearOldUICacheEntries(allTranslations)
    }

    localStorage.setItem(CACHE_KEYS.UI_TRANSLATIONS, JSON.stringify(allTranslations))
    debugLog('Saved UI translations to cache', { 
      locale, 
      keyCount: Object.keys(translations).length,
      size: JSON.stringify(cacheData).length 
    })
  } catch (error) {
    debugLog('Error saving UI translations to cache:', error)
  }
}

export function invalidateUITranslationCache(locale: string): void {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.UI_TRANSLATIONS)
    if (!cached) return

    const allTranslations: Record<string, CachedUITranslation> = JSON.parse(cached)
    delete allTranslations[locale]
    
    localStorage.setItem(CACHE_KEYS.UI_TRANSLATIONS, JSON.stringify(allTranslations))
    debugLog('Invalidated UI translation cache', { locale })
  } catch (error) {
    debugLog('Error invalidating UI translation cache:', error)
  }
}

export function clearAllUICache(): void {
  try {
    localStorage.removeItem(CACHE_KEYS.UI_TRANSLATIONS)
    localStorage.removeItem(CACHE_KEYS.COMPONENT_HASHES)
    localStorage.removeItem(CACHE_KEYS.TRANSLATION_VERSION)
    debugLog('Cleared all UI translation cache')
  } catch (error) {
    debugLog('Error clearing UI translation cache:', error)
  }
}

function clearOldUICacheEntries(allTranslations: Record<string, CachedUITranslation>): void {
  const entries = Object.entries(allTranslations)
  
  // Sort by timestamp (oldest first) and keep only the 3 most recent
  entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)
  
  const toKeep = entries.slice(-3)
  const cleaned: Record<string, CachedUITranslation> = {}
  
  toKeep.forEach(([locale, data]) => {
    cleaned[locale] = data
  })
  
  Object.assign(allTranslations, cleaned)
}

function debugLog(message: string, ...args: any[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Cache Debug] ${message}`, ...args)
  }
}

