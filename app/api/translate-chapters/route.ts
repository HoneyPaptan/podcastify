import { NextRequest, NextResponse } from "next/server"

interface Chapter {
  id: string
  title: string
  content: string
  textContent: string
  wordCount: number
}

interface TranslatedChapter extends Chapter {
  translations: Record<string, {
    title: string
    textContent: string
  }>
}

const TARGET_LANGUAGES = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
]

let lingoEngine: any = null
const translationCache: Map<string, string> = new Map()

async function initializeLingo() {
  if (lingoEngine) return lingoEngine
  
  try {
    const lingoModule = await import("lingo.dev/sdk")
    const LingoDotDevEngine = lingoModule.LingoDotDevEngine || (lingoModule as any).default?.LingoDotDevEngine || (lingoModule as any).default
    
    if (!LingoDotDevEngine) {
      throw new Error("LingoDotDevEngine not found in lingo.dev/sdk")
    }
    
    const apiKey = process.env.LINGO_API_KEY || process.env.NEXT_PUBLIC_LINGO_API_KEY
    
    if (!apiKey) {
      throw new Error("Lingo.dev API key not found")
    }
    
    lingoEngine = new LingoDotDevEngine({
      apiKey: apiKey,
    })
    
    return lingoEngine
  } catch (error) {
    console.error("Failed to initialize Lingo.dev SDK:", error)
    throw error
  }
}

async function translateWithLingo(text: string, targetLocale: string, sourceLocale: string = "en"): Promise<string> {
  if (targetLocale === sourceLocale) {
    return text
  }
  
  const cacheKey = `${sourceLocale}-${targetLocale}-${text}`
  
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!
  }
  
  if (!lingoEngine) {
    await initializeLingo()
  }
  
  if (!lingoEngine) {
    throw new Error("Lingo.dev SDK not initialized")
  }
  
  try {
    const translated = await lingoEngine.localizeText(text, {
      sourceLocale: sourceLocale,
      targetLocale: targetLocale,
    })
    
    if (translated && typeof translated === "string" && translated !== text) {
      translationCache.set(cacheKey, translated)
      return translated
    }
    
    return text
  } catch (error) {
    console.error("Lingo translation error:", error)
    throw error
  }
}

async function translateChapter(chapter: Chapter, languages: string[]): Promise<TranslatedChapter> {
  const translations: Record<string, { title: string; textContent: string }> = {}

  for (const langCode of languages) {
    try {
      console.log(`[Translate Chapter] Translating to ${langCode}...`)
      const startTime = Date.now()
      
      const [translatedTitle, translatedContent] = await Promise.all([
        translateWithLingo(chapter.title, langCode, "en"),
        translateWithLingo(chapter.textContent, langCode, "en"),
      ])

      const duration = Date.now() - startTime
      console.log(`[Translate Chapter] ${langCode} completed in ${duration}ms`)

      translations[langCode] = {
        title: translatedTitle,
        textContent: translatedContent,
      }
    } catch (error) {
      console.error(`[Translate Chapter] Failed to translate to ${langCode}:`, error)
      translations[langCode] = {
        title: chapter.title,
        textContent: chapter.textContent,
      }
    }
  }

  return {
    ...chapter,
    translations,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chapters, languages } = body

    console.log(`[Translate API] Received ${chapters?.length || 0} chapters`)

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json(
        { error: "Chapters array is required" },
        { status: 400 }
      )
    }

    const targetLanguages = languages || TARGET_LANGUAGES.map((lang) => lang.code)
    
    if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return NextResponse.json(
        { error: "Languages array is required" },
        { status: 400 }
      )
    }

    console.log(`[Translate API] Target languages: ${targetLanguages.join(", ")}`)

    const apiKey = process.env.LINGO_API_KEY || process.env.NEXT_PUBLIC_LINGO_API_KEY
    if (!apiKey) {
      console.error("[Translate API] LINGO_API_KEY not found")
      return NextResponse.json(
        { error: "LINGO_API_KEY environment variable is not set" },
        { status: 500 }
      )
    }

    console.log("[Translate API] Initializing Lingo SDK...")
    await initializeLingo()
    console.log("[Translate API] Lingo SDK initialized")

    const translatedChapters: TranslatedChapter[] = []
    const totalTranslations = chapters.length * targetLanguages.length
    let completedTranslations = 0

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i]
      console.log(`[Translate API] Translating chapter ${i + 1}/${chapters.length}: "${chapter.title.substring(0, 50)}..."`)
      
      try {
        const translatedChapter = await translateChapter(chapter, targetLanguages)
        translatedChapters.push(translatedChapter)
        completedTranslations += targetLanguages.length
        console.log(`[Translate API] Chapter ${i + 1} completed (${completedTranslations}/${totalTranslations} translations)`)
      } catch (error) {
        console.error(`[Translate API] Failed to translate chapter ${chapter.id}:`, error)
        translatedChapters.push({
          ...chapter,
          translations: {},
        })
      }
    }

    console.log(`[Translate API] All translations completed: ${translatedChapters.length} chapters`)

    return NextResponse.json({
      chapters: translatedChapters,
      totalChapters: translatedChapters.length,
      languages: targetLanguages,
    })
  } catch (error) {
    console.error("[Translate API] Translation error:", error)
    return NextResponse.json(
      { error: "An error occurred while translating chapters" },
      { status: 500 }
    )
  }
}
