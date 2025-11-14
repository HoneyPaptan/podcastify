import { inngest } from "./client";
import { join } from "path";
import { writeFile } from "fs/promises";
import { updateJob } from "@/lib/jobs-store";

// Import TTS helper functions (we'll need to extract these from the route)
function chunkText(text: string, maxLength: number = 5000): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        chunks.push(sentence.trim());
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function generateTTSWithGemini(
  text: string,
  language: string,
  retryCount = 0,
  maxRetries = 3
): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const model = "gemini-2.5-flash-preview-tts";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  console.log(`[TTS] Calling Gemini TTS API... (attempt ${retryCount + 1}/${maxRetries + 1})`);

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
    });

    if (!response.ok) {
      const errorData = await response.text();

      if ((response.status === 500 || response.status === 503) && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[TTS] Gemini ${response.status} error, retrying after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return generateTTSWithGemini(text, language, retryCount + 1, maxRetries);
      }

      throw new Error(`Gemini TTS API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response format from Gemini TTS API");
    }

    const audioPart = data.candidates[0].content.parts.find(
      (part: any) => part.inlineData && part.inlineData.mimeType?.startsWith("audio/")
    );

    if (!audioPart || !audioPart.inlineData) {
      throw new Error("No audio data found in response");
    }

    const base64Audio = audioPart.inlineData.data;
    const buffer = Buffer.from(base64Audio, "base64");
    const mimeType = audioPart.inlineData.mimeType;

    return { buffer, mimeType };
  } catch (error) {
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`[TTS] Error occurred, retrying after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return generateTTSWithGemini(text, language, retryCount + 1, maxRetries);
    }
    throw error;
  }
}

function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  function writeString(offset: number, str: string) {
    buffer.write(str, offset, str.length, "ascii");
  }

  function writeUInt32LE(offset: number, value: number) {
    buffer.writeUInt32LE(value, offset);
  }

  function writeUInt16LE(offset: number, value: number) {
    buffer.writeUInt16LE(value, offset);
  }

  writeString(0, "RIFF");
  writeUInt32LE(4, fileSize);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  writeUInt32LE(16, 16);
  writeUInt16LE(20, 1);
  writeUInt16LE(22, channels);
  writeUInt32LE(24, sampleRate);
  writeUInt32LE(28, byteRate);
  writeUInt16LE(32, blockAlign);
  writeUInt16LE(34, bitsPerSample);
  writeString(36, "data");

  const length = dataSize > 0xffffffff ? 0xffffffff : dataSize;

  writeUInt32LE(40, length);
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

async function ensureAudioDir() {
  const { mkdir } = await import("fs/promises");
  const AUDIO_DIR = join(process.cwd(), "public", "audio");
  try {
    await mkdir(AUDIO_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Background function for audio generation
export const generateAudioBackground = inngest.createFunction(
  { id: "generate-audio-background", name: "Generate Audio in Background" },
  { event: "audio/generate.requested" },
  async ({ event, step }) => {
    const { text, language, chapterId, sessionId, jobId } = event.data;

    console.log(`[Inngest] Starting audio generation for chapter ${chapterId} in ${language}`);

    // Update job status to processing
    if (jobId) {
      updateJob(jobId, { status: "processing" });
    }

    // Step 1: Check for existing audio
    const existingAudio = await step.run("check-existing-audio", async () => {
      const AUDIO_DIR = join(process.cwd(), "public", "audio");
      const { readdir } = await import("fs/promises");
      
      try {
        const existingFiles = await readdir(AUDIO_DIR);
        const existingFile = existingFiles.find((file: string) =>
          file.startsWith(`${chapterId}-${language}-`) &&
          (file.endsWith(".mp3") || file.endsWith(".wav") || file.endsWith(".ogg") || file.endsWith(".m4a"))
        );

        if (existingFile) {
          console.log(`[Inngest] Using existing audio file: ${existingFile}`);
          return `/audio/${existingFile}`;
        }
      } catch (error) {
        console.log("[Inngest] Audio directory not found, creating...");
      }
      
      return null;
    });

    if (existingAudio) {
      // Update job as completed with cached audio
      if (jobId) {
        updateJob(jobId, { 
          status: "completed", 
          audioUrl: existingAudio 
        });
      }
      return { audioUrl: existingAudio, cached: true, chapterId, language };
    }

    // Step 2: Ensure audio directory exists
    await step.run("ensure-audio-dir", async () => {
      await ensureAudioDir();
    });

    // Step 3: Generate audio with progress tracking
    const audioUrl = await step.run("generate-audio", async () => {
      try {
        const AUDIO_DIR = join(process.cwd(), "public", "audio");
        const chunks = chunkText(text, 5000);
        let detectedMimeType = "audio/mpeg";
        let sampleRate = 24000;

        console.log(`[Inngest] Generating audio for ${chunks.length} chunks`);

        const audioFileName = `${chapterId}-${language}-${Date.now()}.wav`;
        const audioPath = join(AUDIO_DIR, audioFileName);

      if (chunks.length === 1) {
        const result = await generateTTSWithGemini(chunks[0], language);
        detectedMimeType = result.mimeType;

        let audioBuffer = result.buffer;

        if (detectedMimeType.includes("L16") || detectedMimeType.includes("pcm")) {
          const rateMatch = detectedMimeType.match(/rate=(\d+)/);
          if (rateMatch) {
            sampleRate = parseInt(rateMatch[1], 10);
          }
          console.log(`[Inngest] Converting PCM to WAV format (sample rate: ${sampleRate}Hz)`);
          audioBuffer = pcmToWav(result.buffer, sampleRate);
        }

        await writeFile(audioPath, audioBuffer);
        console.log(`[Inngest] Audio file saved: ${audioPath}, size: ${audioBuffer.length} bytes`);
      } else {
        const audioChunks: Buffer[] = [];
        for (let i = 0; i < chunks.length; i++) {
          console.log(`[Inngest] Processing chunk ${i + 1}/${chunks.length}`);
          const result = await generateTTSWithGemini(chunks[i], language);
          audioChunks.push(result.buffer);
          if (i === 0) {
            detectedMimeType = result.mimeType;
            if (detectedMimeType.includes("L16") || detectedMimeType.includes("pcm")) {
              const rateMatch = detectedMimeType.match(/rate=(\d+)/);
              if (rateMatch) {
                sampleRate = parseInt(rateMatch[1], 10);
              }
            }
          }
        }

        let combinedAudio = Buffer.concat(audioChunks);

        if (detectedMimeType.includes("L16") || detectedMimeType.includes("pcm")) {
          console.log(`[Inngest] Converting PCM to WAV format (sample rate: ${sampleRate}Hz)`);
          combinedAudio = pcmToWav(combinedAudio, sampleRate);
        }

        await writeFile(audioPath, combinedAudio);
        console.log(`[Inngest] Audio file saved: ${audioPath}, size: ${combinedAudio.length} bytes`);
      }

      return `/audio/${audioFileName}`;
      } catch (error) {
        // Update job as failed
        if (jobId) {
          updateJob(jobId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Audio generation failed"
          });
        }
        throw error;
      }
    });

    console.log(`[Inngest] Audio generation complete: ${audioUrl}`);

    // Update job as completed
    if (jobId) {
      updateJob(jobId, { 
        status: "completed", 
        audioUrl 
      });
    }

    return { audioUrl, cached: false, chapterId, language, sessionId };
  }
);

