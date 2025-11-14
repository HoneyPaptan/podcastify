import { NextRequest, NextResponse } from "next/server"
import { JSDOM } from "jsdom"

interface Chapter {
  id: string
  title: string
  content: string
  textContent: string
  wordCount: number
}

function extractChaptersFromHTML(html: string): Chapter[] {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const body = document.body

  if (!body) {
    return []
  }

  const chapters: Chapter[] = []
  let currentChapter: { title: string; elements: Element[] } | null = null
  const allElements = Array.from(body.querySelectorAll("*"))

  for (const element of allElements) {
    const tagName = element.tagName.toLowerCase()
    
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
      if (currentChapter && currentChapter.elements.length > 0) {
        const chapter = createChapterFromElements(currentChapter.title, currentChapter.elements)
        if (chapter) {
          chapters.push(chapter)
        }
      }
      
      const headingText = element.textContent?.trim() || ""
      if (headingText) {
        currentChapter = {
          title: headingText,
          elements: [element],
        }
      }
    } else if (currentChapter) {
      currentChapter.elements.push(element)
    }
  }

  if (currentChapter && currentChapter.elements.length > 0) {
    const chapter = createChapterFromElements(currentChapter.title, currentChapter.elements)
    if (chapter) {
      chapters.push(chapter)
    }
  }

  return chapters
}

function createChapterFromElements(title: string, elements: Element[]): Chapter | null {
  const dom = new JSDOM()
  const container = dom.window.document.createElement("div")
  
  elements.forEach((el) => {
    container.appendChild(el.cloneNode(true))
  })

  const html = container.innerHTML
  const textContent = container.textContent || ""
  const wordCount = textContent.split(/\s+/).filter((word) => word.length > 0).length

  if (wordCount < 10) {
    return null
  }

  const chapterTitle = title || extractTitleFromContent(textContent)

  return {
    id: `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: chapterTitle,
    content: html,
    textContent: textContent.trim(),
    wordCount,
  }
}

function extractTitleFromContent(text: string): string {
  const firstSentence = text.split(/[.!?]\s+/)[0]?.trim()
  if (firstSentence && firstSentence.length > 0) {
    const maxLength = 60
    return firstSentence.length > maxLength
      ? firstSentence.substring(0, maxLength) + "..."
      : firstSentence
  }
  return "Untitled Chapter"
}

function splitByWordLimit(textContent: string, wordLimit: number = 500): Chapter[] {
  const sentences = textContent.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0)
  const chapters: Chapter[] = []
  let currentChapter: string[] = []
  let currentWordCount = 0

  for (const sentence of sentences) {
    const sentenceWordCount = sentence.split(/\s+/).filter((w) => w.length > 0).length
    
    if (currentWordCount + sentenceWordCount > wordLimit && currentChapter.length > 0) {
      const chapterText = currentChapter.join(" ")
      const chapterTitle = extractTitleFromContent(chapterText)
      
      chapters.push({
        id: `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: chapterTitle,
        content: `<p>${chapterText}</p>`,
        textContent: chapterText,
        wordCount: currentWordCount,
      })
      
      currentChapter = [sentence]
      currentWordCount = sentenceWordCount
    } else {
      currentChapter.push(sentence)
      currentWordCount += sentenceWordCount
    }
  }

  if (currentChapter.length > 0) {
    const chapterText = currentChapter.join(" ")
    const chapterTitle = extractTitleFromContent(chapterText)
    
    chapters.push({
      id: `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: chapterTitle,
      content: `<p>${chapterText}</p>`,
      textContent: chapterText,
      wordCount: currentWordCount,
    })
  }

  return chapters
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, textContent } = body

    if (!content && !textContent) {
      return NextResponse.json(
        { error: "Content or textContent is required" },
        { status: 400 }
      )
    }

    let chapters: Chapter[] = []

    if (content) {
      chapters = extractChaptersFromHTML(content)
    }

    if (chapters.length === 0 && textContent) {
      chapters = splitByWordLimit(textContent, 500)
    }

    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "Could not generate chapters from the content" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      chapters,
      totalChapters: chapters.length,
      totalWords: chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
    })
  } catch (error) {
    console.error("Chapter generation error:", error)
    return NextResponse.json(
      { error: "An error occurred while generating chapters" },
      { status: 500 }
    )
  }
}

