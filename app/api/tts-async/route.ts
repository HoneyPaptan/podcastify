import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { createJob } from "@/lib/jobs-store";
import { join } from "path";

const AUDIO_DIR = join(process.cwd(), "public", "audio");

// POST /api/tts-async - Trigger background audio generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, language, chapterId, sessionId } = body;

    if (!text || !language || !chapterId || !sessionId) {
      return NextResponse.json(
        { error: "Text, language, chapterId, and sessionId are required" },
        { status: 400 }
      );
    }

    if (text.length === 0) {
      return NextResponse.json(
        { error: "Text cannot be empty" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    // Check for existing audio first
    const existingFiles = await import("fs/promises").then((fs) =>
      fs.readdir(AUDIO_DIR).catch(() => [])
    );

    const existingFile = existingFiles.find((file: string) =>
      file.startsWith(`${chapterId}-${language}-`) &&
      (file.endsWith(".mp3") || file.endsWith(".wav") || file.endsWith(".ogg") || file.endsWith(".m4a"))
    );

    if (existingFile) {
      console.log(`[TTS Async] Using existing audio file: ${existingFile}`);
      return NextResponse.json({
        audioUrl: `/audio/${existingFile}`,
        chapterId: chapterId,
        language: language,
        cached: true,
        jobId: null,
      });
    }

    // Create a job entry
    const job = createJob(sessionId, chapterId, language);

    // Trigger Inngest background function
    await inngest.send({
      name: "audio/generate.requested",
      data: {
        text,
        language,
        chapterId,
        sessionId,
        jobId: job.id,
      },
    });

    console.log(`[TTS Async] Background job triggered: ${job.id}`);

    return NextResponse.json({
      jobId: job.id,
      chapterId,
      language,
      status: "pending",
      message: "Audio generation started in background",
    });
  } catch (error) {
    console.error("[TTS Async] Error:", error);
    return NextResponse.json(
      { error: "An error occurred while triggering audio generation" },
      { status: 500 }
    );
  }
}

