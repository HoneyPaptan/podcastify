import { NextRequest, NextResponse } from "next/server"

interface Chapter {
  id: string
  title: string
  content: string
  textContent: string
  wordCount: number
}

async function summarizeWithGemini(text: string, targetChapters: number = 3): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set")
  }

  const model = "gemini-2.0-flash-lite"
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const prompt = `You are a content summarizer. Your task is to condense the following blog content into exactly ${targetChapters} well-structured chapters.

Requirements:
- Create exactly ${targetChapters} chapters
- Each chapter should be substantial and meaningful
- Preserve the key ideas and main points
- Keep the natural flow and narrative structure
- Each chapter should be roughly equal in length
- Total word count should be under 2000 words

Return the content as ${targetChapters} chapters separated by clear chapter markers. Format:
CHAPTER 1: [Title]
[Content]

CHAPTER 2: [Title]
[Content]

CHAPTER 3: [Title]
[Content]

Content to summarize:
${text}`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${errorData}`)
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response format from Gemini API")
    }

    const summarizedText = data.candidates[0].content.parts[0].text.trim()
    return summarizedText
  } catch (error) {
    console.error("Gemini summarization error:", error)
    throw error
  }
}

function parseSummarizedChapters(summarizedText: string): Chapter[] {
  const chapters: Chapter[] = []
  const chapterRegex = /CHAPTER\s+(\d+):\s*(.+?)(?=CHAPTER\s+\d+:|$)/gis
  
  let match
  let chapterIndex = 1
  
  while ((match = chapterRegex.exec(summarizedText)) !== null) {
    const title = match[2].split('\n')[0].trim()
    const content = match[2].substring(title.length).trim()
    const textContent = content.replace(/<[^>]*>/g, '').trim()
    const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length

    if (wordCount > 50) {
      chapters.push({
        id: `chapter-${Date.now()}-${chapterIndex}`,
        title: title || `Chapter ${chapterIndex}`,
        content: `<p>${content.replace(/\n/g, '</p><p>')}</p>`,
        textContent: textContent,
        wordCount: wordCount,
      })
      chapterIndex++
    }
  }

  if (chapters.length === 0) {
    const paragraphs = summarizedText.split(/\n\n+/).filter(p => p.trim().length > 0)
    const chunksPerChapter = Math.ceil(paragraphs.length / 3)
    
    for (let i = 0; i < 3 && i * chunksPerChapter < paragraphs.length; i++) {
      const start = i * chunksPerChapter
      const end = Math.min(start + chunksPerChapter, paragraphs.length)
      const chapterContent = paragraphs.slice(start, end).join('\n\n')
      const textContent = chapterContent.replace(/<[^>]*>/g, '').trim()
      const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length
      const title = chapterContent.split('\n')[0].substring(0, 60) || `Chapter ${i + 1}`

      chapters.push({
        id: `chapter-${Date.now()}-${i + 1}`,
        title: title,
        content: `<p>${chapterContent.replace(/\n/g, '</p><p>')}</p>`,
        textContent: textContent,
        wordCount: wordCount,
      })
    }
  }

  return chapters
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chapters, targetChapters = 3 } = body

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json(
        { error: "Chapters array is required" },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not set" },
        { status: 500 }
      )
    }

    const combinedText = chapters.map(ch => `${ch.title}\n\n${ch.textContent}`).join('\n\n---\n\n')
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0)

    console.log(`[Summarize] Condensing ${chapters.length} chapters (${totalWords} words) into ${targetChapters} chapters`)

    const summarizedText = await summarizeWithGemini(combinedText, targetChapters)
    const summarizedChapters = parseSummarizedChapters(summarizedText)

    const finalWordCount = summarizedChapters.reduce((sum, ch) => sum + ch.wordCount, 0)
    console.log(`[Summarize] Created ${summarizedChapters.length} chapters (${finalWordCount} words)`)

    return NextResponse.json({
      chapters: summarizedChapters,
      totalChapters: summarizedChapters.length,
      totalWords: finalWordCount,
      originalChapters: chapters.length,
      originalWords: totalWords,
    })
  } catch (error) {
    console.error("Summarization error:", error)
    return NextResponse.json(
      { error: "An error occurred while summarizing chapters" },
      { status: 500 }
    )
  }
}

