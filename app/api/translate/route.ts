import { NextRequest, NextResponse } from "next/server"

let lingoEngine: any = null
const translationCache: Map<string, string> = new Map()

async function initializeLingo() {
  if (lingoEngine) return lingoEngine
  
  try {
    const { LingoDotDevEngine } = await import("lingo.dev/sdk")
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

async function translateText(text: string, targetLocale: string, sourceLocale: string = "en"): Promise<string> {
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
    return text
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
    console.error("Translation error:", error)
    return text
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, targetLocale, sourceLocale = "en" } = body
    
    if (!text || !targetLocale) {
      return NextResponse.json(
        { error: "Missing required fields: text, targetLocale" },
        { status: 400 }
      )
    }
    
    const translated = await translateText(text, targetLocale, sourceLocale)
    
    return NextResponse.json({ translated })
  } catch (error) {
    console.error("Translation API error:", error)
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const text = searchParams.get("text")
  const targetLocale = searchParams.get("targetLocale")
  const sourceLocale = searchParams.get("sourceLocale") || "en"
  
  if (!text || !targetLocale) {
    return NextResponse.json(
      { error: "Missing required query params: text, targetLocale" },
      { status: 400 }
    )
  }
  
  try {
    const translated = await translateText(text, targetLocale, sourceLocale)
    return NextResponse.json({ translated })
  } catch (error) {
    console.error("Translation API error:", error)
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    )
  }
}

