import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { AudioStorageManager } from "@/lib/audio-storage"

export async function POST(request: NextRequest) {
  try {
    const { audioFiles } = await request.json()

    if (!audioFiles || !Array.isArray(audioFiles) || audioFiles.length === 0) {
      return NextResponse.json({ error: "No audio files provided" }, { status: 400 })
    }

    console.log("[Merge] Merging audio files:", audioFiles)

    // Read all audio files
    const audioBuffers: Buffer[] = []
    for (const fileName of audioFiles) {
      let buffer: Buffer

      // Check if fileName is a URL (Vercel Blob) or local file
      if (fileName.startsWith('http')) {
        // Fetch from Vercel Blob
        console.log(`[Merge] Fetching from URL: ${fileName}`)
        const response = await fetch(fileName)
        if (!response.ok) {
          console.error(`[Merge] Failed to fetch audio: ${fileName}`)
          return NextResponse.json({ error: `Failed to fetch audio file: ${fileName}` }, { status: 404 })
        }
        const arrayBuffer = await response.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
      } else {
        // Read local file
        const filePath = path.join(process.cwd(), "public", "audio", fileName)
        
        if (!fs.existsSync(filePath)) {
          console.error(`[Merge] Local file not found: ${filePath}, attempting to find in storage`)
          
          // Try to find the file via AudioStorageManager
          const parts = fileName.split('-')
          if (parts.length >= 3) {
            const chapterId = parts.slice(0, -2).join('-')
            const language = parts.slice(-2)[0]
            
            try {
              const audioInfo = await AudioStorageManager.getAudioInfo(chapterId, language)
              if (audioInfo && audioInfo.url) {
                console.log(`[Merge] Found audio in storage: ${audioInfo.url}`)
                const response = await fetch(audioInfo.url)
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer()
                  buffer = Buffer.from(arrayBuffer)
                } else {
                  return NextResponse.json({ error: `Failed to fetch audio from storage: ${fileName}` }, { status: 404 })
                }
              } else {
                return NextResponse.json({ error: `Audio file not found in storage: ${fileName}` }, { status: 404 })
              }
            } catch (error) {
              console.error(`[Merge] Error fetching from storage:`, error)
              return NextResponse.json({ error: `Error fetching audio from storage: ${fileName}` }, { status: 500 })
            }
          } else {
            return NextResponse.json({ error: `Invalid audio file name format: ${fileName}` }, { status: 400 })
          }
        } else {
          buffer = fs.readFileSync(filePath)
        }
      }
      
      audioBuffers.push(buffer)
    }

    // Simple concatenation for WAV files
    // For a more robust solution, you'd need to parse WAV headers and merge properly
    // For now, we'll just concatenate the audio data after the first header
    let mergedBuffer: Buffer

    if (audioBuffers.length === 1) {
      mergedBuffer = audioBuffers[0]
    } else {
      // This is a simple approach - for production, use a proper audio library
      // We'll skip the WAV header (44 bytes) for all files except the first
      const firstFile = audioBuffers[0]
      const restFiles = audioBuffers.slice(1).map(buf => buf.slice(44))
      
      mergedBuffer = Buffer.concat([firstFile, ...restFiles])
    }

    // Store merged file using AudioStorageManager
    const timestamp = Date.now()
    const chapterId = `merged-${timestamp}`
    const language = "merged"
    
    const storedAudio = await AudioStorageManager.storeAudio({
      chapterId,
      language,
      audioBuffer: mergedBuffer,
      mimeType: "audio/wav"
    })
    
    console.log(`[Merge] Created merged file: ${storedAudio.url}`)

    return NextResponse.json({
      success: true,
      fileName: `${chapterId}-${language}.wav`,
      url: storedAudio.url,
    })
  } catch (error) {
    console.error("[Merge] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to merge audio files" },
      { status: 500 }
    )
  }
}

