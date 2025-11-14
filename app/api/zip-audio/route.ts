import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { readFile, writeFile, unlink } from "fs/promises";
import JSZip from "jszip";

const AUDIO_DIR = join(process.cwd(), "public", "audio");

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
      const filePath = join(AUDIO_DIR, filename);
      
      try {
        const fileBuffer = await readFile(filePath);
        zip.file(filename, fileBuffer);
        console.log(`[ZIP] Added ${filename} to zip`);
      } catch (error) {
        console.error(`[ZIP] Failed to read ${filename}:`, error);
        return NextResponse.json(
          { error: `Failed to read audio file: ${filename}` },
          { status: 500 }
        );
      }
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Save the zip file
    const zipFileName = `podcast-bundle-${Date.now()}.zip`;
    const zipFilePath = join(AUDIO_DIR, zipFileName);
    await writeFile(zipFilePath, zipBuffer);

    console.log(`[ZIP] Zip file created: ${zipFileName}, size: ${zipBuffer.length} bytes`);

    // Schedule cleanup after 5 minutes
    setTimeout(async () => {
      try {
        await unlink(zipFilePath);
        console.log(`[ZIP] Cleaned up: ${zipFileName}`);
      } catch (error) {
        console.error(`[ZIP] Failed to cleanup ${zipFileName}:`, error);
      }
    }, 5 * 60 * 1000);

    return NextResponse.json({
      url: `/audio/${zipFileName}`,
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

