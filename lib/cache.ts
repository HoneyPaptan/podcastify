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

