import { NextRequest, NextResponse } from "next/server"
import { Readability } from "@mozilla/readability"
import { JSDOM } from "jsdom"
import { unified } from "unified"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import rehypeSanitize from "rehype-sanitize"

interface ScrapedContent {
  title: string
  content: string
  textContent: string
  byline?: string
  excerpt?: string
  siteName?: string
}

async function fetchHTML(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    throw new Error(`Network error: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

function extractContent(html: string, url: string): ScrapedContent {
  const dom = new JSDOM(html, { url })
  const document = dom.window.document
  const reader = new Readability(document)
  const article = reader.parse()

  if (!article) {
    throw new Error("Failed to extract article content")
  }

  return {
    title: article.title || "",
    content: article.content || "",
    textContent: article.textContent || "",
    byline: article.byline || undefined,
    excerpt: article.excerpt || undefined,
    siteName: article.siteName || undefined,
  }
}

async function cleanHTML(html: string): Promise<string> {
  try {
    const processor = unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSanitize)
      .use(rehypeStringify)

    const cleaned = await processor.process(html)
    return String(cleaned)
  } catch (error) {
    console.warn("HTML cleaning failed, returning original:", error)
    return html
  }
}

function htmlToText(html: string): string {
  const dom = new JSDOM(html)
  const text = dom.window.document.body.textContent || ""
  
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      )
    }

    const urlPattern = /^https?:\/\/.+\..+/
    if (!urlPattern.test(url)) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      )
    }

    const html = await fetchHTML(url)
    const extracted = extractContent(html, url)
    const cleanedHTML = await cleanHTML(extracted.content)
    const textContent = htmlToText(cleanedHTML)

    const result = {
      title: extracted.title,
      content: cleanedHTML,
      textContent: textContent,
      byline: extracted.byline,
      excerpt: extracted.excerpt,
      siteName: extracted.siteName,
      url: url,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Scraping error:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("Network error")) {
      return NextResponse.json(
        { error: "Failed to fetch the webpage. Please check the URL and try again." },
        { status: 400 }
      )
    }

    if (errorMessage.includes("Failed to extract")) {
      return NextResponse.json(
        { error: "Could not extract readable content from this page." },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "An error occurred while scraping the content" },
      { status: 500 }
    )
  }
}

