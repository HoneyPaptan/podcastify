import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { readFile, writeFile, unlink } from "fs/promises";
import JSZip from "jszip";
import { AudioStorageManager } from "@/lib/audio-storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioFiles } = body;

    if (!audioFiles || !Array.isArray(audioFiles) || audioFiles.length === 0) {
      return NextResponse.json(
        { error: "Audio files array is required" },
        { status: 400 }
      );
    }

    console.log(`[ZIP] Creating zip with ${audioFiles.length} files`);

    // Create a new JSZip instance
    const zip = new JSZip();

    // Add each audio file to the zip
    for (const filename of audioFiles) {
      let fileBuffer: Buffer
      
      // Check if filename is a URL (Vercel Blob) or local file
      if (filename.startsWith('http')) {
        // Fetch from Vercel Blob
        const response = await fetch(filename)
        if (!response.ok) {
          console.error(`[ZIP] Failed to fetch audio: ${filename}`)
          return NextResponse.json(
            { error: `Failed to fetch audio file: ${filename}` },
            { status: 500 }
          )
        }
        const arrayBuffer = await response.arrayBuffer()
        fileBuffer = Buffer.from(arrayBuffer)
      } else {
        // Read local file
        const AUDIO_DIR = join(process.cwd(), "public", "audio");
        const filePath = join(AUDIO_DIR, filename);
        
        try {
          fileBuffer = await readFile(filePath);
        } catch (error) {
          console.error(`[ZIP] Failed to read ${filename}:`, error);
          return NextResponse.json(
            { error: `Failed to read audio file: ${filename}` },
            { status: 500 }
          );
        }
      }
      
      // Extract just the filename from URL if needed
      const zipFilename = filename.startsWith('http') 
        ? filename.split('/').pop() || filename
        : filename
      
      zip.file(zipFilename, fileBuffer);
      console.log(`[ZIP] Added ${zipFilename} to zip`);
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Store the zip file using AudioStorageManager
    const timestamp = Date.now()
    const chapterId = `podcast-bundle-${timestamp}`
    const language = "zip"
    
    const storedZip = await AudioStorageManager.storeAudio({
      chapterId,
      language,
      audioBuffer: zipBuffer,
      mimeType: "application/zip"
    })
    
    const zipFileName = `${chapterId}-${language}.zip`;

    console.log(`[ZIP] Zip file created: ${storedZip.url}, size: ${zipBuffer.length} bytes`);

    return NextResponse.json({
      url: storedZip.url,
      filename: zipFileName,
      size: zipBuffer.length,
      fileCount: audioFiles.length,
    });
  } catch (error) {
    console.error("[ZIP] Error:", error);
    return NextResponse.json(
      { error: "An error occurred while creating zip file" },
      { status: 500 }
    );
  }
}

