import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { generateAudioBackground } from "@/lib/inngest/functions";

// Serve Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateAudioBackground,
  ],
});

