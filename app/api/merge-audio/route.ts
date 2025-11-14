import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

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
      const filePath = path.join(process.cwd(), "public", "audio", fileName)
      
      if (!fs.existsSync(filePath)) {
        console.error(`[Merge] File not found: ${filePath}`)
        return NextResponse.json({ error: `Audio file not found: ${fileName}` }, { status: 404 })
      }

      const buffer = fs.readFileSync(filePath)
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

    // Save merged file
    const timestamp = Date.now()
    const mergedFileName = `merged-${timestamp}.wav`
    const mergedFilePath = path.join(process.cwd(), "public", "audio", mergedFileName)
    
    fs.writeFileSync(mergedFilePath, mergedBuffer)
    console.log(`[Merge] Created merged file: ${mergedFileName}`)

    return NextResponse.json({
      success: true,
      fileName: mergedFileName,
      url: `/audio/${mergedFileName}`,
    })
  } catch (error) {
    console.error("[Merge] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to merge audio files" },
      { status: 500 }
    )
  }
}

