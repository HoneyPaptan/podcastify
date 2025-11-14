import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const AUDIO_DIR = join(process.cwd(), "public", "audio")

async function ensureAudioDir() {
  if (!existsSync(AUDIO_DIR)) {
    await mkdir(AUDIO_DIR, { recursive: true })
  }
}

function chunkText(text: string, maxLength: number = 5000): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ""

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

async function generateTTSWithGemini(text: string, language: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set")
  }

  const model = "gemini-2.5-flash-preview-tts"
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

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
                text: text,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Gemini TTS API error: ${response.status} - ${errorData}`)
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response format from Gemini TTS API")
    }

    const audioPart = data.candidates[0].content.parts.find(
      (part: any) => part.inlineData && part.inlineData.mimeType?.startsWith("audio/")
    )

    if (!audioPart || !audioPart.inlineData) {
      console.error("No audio part found in response:", JSON.stringify(data, null, 2))
      throw new Error("No audio data in response")
    }

    const mimeType = audioPart.inlineData.mimeType || "audio/mpeg"
    const audioBase64 = audioPart.inlineData.data
    const audioBuffer = Buffer.from(audioBase64, "base64")

    console.log(`[TTS] Received audio format: ${mimeType}, size: ${audioBuffer.length} bytes`)

    return { buffer: audioBuffer, mimeType }
  } catch (error) {
    console.error("Gemini TTS error:", error)
    throw error
  }
}

function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, channels: number = 1, bitsPerSample: number = 16): Buffer {
  const length = pcmBuffer.length
  const buffer = Buffer.alloc(44 + length)
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      buffer[offset + i] = string.charCodeAt(i)
    }
  }
  
  const writeUInt32LE = (offset: number, value: number) => {
    buffer[offset] = value & 0xff
    buffer[offset + 1] = (value >> 8) & 0xff
    buffer[offset + 2] = (value >> 16) & 0xff
    buffer[offset + 3] = (value >> 24) & 0xff
  }
  
  const writeUInt16LE = (offset: number, value: number) => {
    buffer[offset] = value & 0xff
    buffer[offset + 1] = (value >> 8) & 0xff
  }
  
  writeString(0, 'RIFF')
  writeUInt32LE(4, 36 + length)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  writeUInt32LE(16, 16)
  writeUInt16LE(20, 1)
  writeUInt16LE(22, channels)
  writeUInt32LE(24, sampleRate)
  writeUInt32LE(28, sampleRate * channels * bitsPerSample / 8)
  writeUInt16LE(32, channels * bitsPerSample / 8)
  writeUInt16LE(34, bitsPerSample)
  writeString(36, 'data')
  writeUInt32LE(40, length)
  pcmBuffer.copy(buffer, 44)
  
  return buffer
}

async function generateAudioForText(text: string, language: string, outputPath: string, audioFileName: string): Promise<string> {
  await ensureAudioDir()

  const chunks = chunkText(text, 5000)
  let detectedMimeType = "audio/mpeg"
  let sampleRate = 24000

  console.log(`[TTS] Generating audio for ${chunks.length} chunks`)

  if (chunks.length === 1) {
    const result = await generateTTSWithGemini(chunks[0], language)
    detectedMimeType = result.mimeType
    
    let audioBuffer = result.buffer
    
    if (detectedMimeType.includes("L16") || detectedMimeType.includes("pcm")) {
      const rateMatch = detectedMimeType.match(/rate=(\d+)/)
      if (rateMatch) {
        sampleRate = parseInt(rateMatch[1], 10)
      }
      console.log(`[TTS] Converting PCM to WAV format (sample rate: ${sampleRate}Hz)`)
      audioBuffer = pcmToWav(result.buffer, sampleRate)
      const wavFileName = audioFileName.replace(/\.mp3$/, ".wav")
      outputPath = outputPath.replace(/\.mp3$/, ".wav")
      audioFileName = wavFileName
    }
    
    await writeFile(outputPath, audioBuffer)
    console.log(`[TTS] Audio file saved: ${outputPath}, size: ${audioBuffer.length} bytes, format: ${detectedMimeType}`)
  } else {
    const audioChunks: Buffer[] = []
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[TTS] Processing chunk ${i + 1}/${chunks.length}`)
      const result = await generateTTSWithGemini(chunks[i], language)
      audioChunks.push(result.buffer)
      if (i === 0) {
        detectedMimeType = result.mimeType
        if (detectedMimeType.includes("L16") || detectedMimeType.includes("pcm")) {
          const rateMatch = detectedMimeType.match(/rate=(\d+)/)
          if (rateMatch) {
            sampleRate = parseInt(rateMatch[1], 10)
          }
        }
      }
    }
    
    let combinedAudio = Buffer.concat(audioChunks)
    
    if (detectedMimeType.includes("L16") || detectedMimeType.includes("pcm")) {
      console.log(`[TTS] Converting PCM to WAV format (sample rate: ${sampleRate}Hz)`)
      combinedAudio = pcmToWav(combinedAudio, sampleRate)
      const wavFileName = audioFileName.replace(/\.mp3$/, ".wav")
      outputPath = outputPath.replace(/\.mp3$/, ".wav")
      audioFileName = wavFileName
    }
    
    await writeFile(outputPath, combinedAudio)
    console.log(`[TTS] Audio file saved: ${outputPath}, size: ${combinedAudio.length} bytes, format: ${detectedMimeType}`)
  }

  const audioUrl = `/audio/${audioFileName}`
  return audioUrl
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, language, chapterId } = body

    if (!text || !language || !chapterId) {
      return NextResponse.json(
        { error: "Text, language, and chapterId are required" },
        { status: 400 }
      )
    }

    if (text.length === 0) {
      return NextResponse.json(
        { error: "Text cannot be empty" },
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

    const existingFiles = await import("fs/promises").then((fs) => 
      fs.readdir(AUDIO_DIR).catch(() => [])
    )
    
    const existingFile = existingFiles.find((file: string) => 
      file.startsWith(`${chapterId}-${language}-`) && (file.endsWith(".mp3") || file.endsWith(".wav") || file.endsWith(".ogg") || file.endsWith(".m4a"))
    )

    if (existingFile) {
      console.log(`[TTS] Using existing audio file: ${existingFile}`)
      return NextResponse.json({
        audioUrl: `/audio/${existingFile}`,
        chapterId: chapterId,
        language: language,
        cached: true,
      })
    }

    const audioFileName = `${chapterId}-${language}-${Date.now()}.wav`
    const audioPath = join(AUDIO_DIR, audioFileName)
    const audioUrl = await generateAudioForText(text, language, audioPath, audioFileName)

    console.log(`[TTS] Audio generated: ${audioUrl}`)

    return NextResponse.json({
      audioUrl: audioUrl,
      chapterId: chapterId,
      language: language,
      cached: false,
    })
  } catch (error) {
    console.error("[TTS] Error:", error)
    return NextResponse.json(
      { error: "An error occurred while generating audio" },
      { status: 500 }
    )
  }
}

