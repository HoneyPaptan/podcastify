import { NextRequest, NextResponse } from "next/server"

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
      batchSize: 250, // Maximum allowed for optimal performance
      idealBatchItemSize: 2500, // Maximum allowed for optimal performance
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

async function translateChapterObject(chapter: any, targetLocale: string, sourceLocale: string = "en"): Promise<{title: string, textContent: string}> {
  if (targetLocale === sourceLocale) {
    return { title: chapter.title, textContent: chapter.textContent }
  }
  
  if (!lingoEngine) {
    await initializeLingo()
  }
  
  if (!lingoEngine) {
    throw new Error("Lingo.dev SDK not initialized")
  }
  
  try {
    const chapterObject = {
      title: chapter.title,
      textContent: chapter.textContent
    }
    
    const translated = await lingoEngine.localizeObject(chapterObject, {
      sourceLocale: sourceLocale,
      targetLocale: targetLocale,
    })
    
    // Cache individual translations
    const titleCacheKey = `${sourceLocale}-${targetLocale}-${chapter.title}`
    const contentCacheKey = `${sourceLocale}-${targetLocale}-${chapter.textContent}`
    
    if (translated.title && translated.title !== chapter.title) {
      translationCache.set(titleCacheKey, translated.title)
    }
    
    if (translated.textContent && translated.textContent !== chapter.textContent) {
      translationCache.set(contentCacheKey, translated.textContent)
    }
    
    return {
      title: translated.title || chapter.title,
      textContent: translated.textContent || chapter.textContent
    }
  } catch (error) {
    console.error("Chapter object translation error:", error)
    // Fallback to individual translations
    const [translatedTitle, translatedContent] = await Promise.all([
      translateWithLingo(chapter.title, targetLocale, sourceLocale),
      translateWithLingo(chapter.textContent, targetLocale, sourceLocale),
    ])
    
    return { title: translatedTitle, textContent: translatedContent }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chapter, targetLocale, sourceLocale = "en" } = body

    if (!chapter || !targetLocale) {
      return NextResponse.json(
        { error: "Chapter and targetLocale are required" },
        { status: 400 }
      )
    }

    const apiKey = process.env.LINGO_API_KEY || process.env.NEXT_PUBLIC_LINGO_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "LINGO_API_KEY environment variable is not set" },
        { status: 500 }
      )
    }

    await initializeLingo()

    console.log(`[Translate Chapter] Translating chapter "${chapter.title.substring(0, 50)}..." to ${targetLocale}`)

    const translated = await translateChapterObject(chapter, targetLocale, sourceLocale)
    const translatedTitle = translated.title
    const translatedContent = translated.textContent

    console.log(`[Translate Chapter] Translation completed for ${targetLocale}`)

    return NextResponse.json({
      chapterId: chapter.id,
      translations: {
        [targetLocale]: {
          title: translatedTitle,
          textContent: translatedContent,
        },
      },
    })
  } catch (error) {
    console.error("[Translate Chapter] Translation error:", error)
    return NextResponse.json(
      { error: "An error occurred while translating the chapter" },
      { status: 500 }
    )
  }
}

