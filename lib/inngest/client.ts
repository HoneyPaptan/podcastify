import { Inngest } from "inngest";

// Create an Inngest client
// For production, use INNGEST_EVENT_KEY from environment variables
// For local dev, the Inngest Dev Server provides the event key
export const inngest = new Inngest({ 
  id: "podcastify",
  name: "Podcastify Audio Generator",
  eventKey: process.env.INNGEST_EVENT_KEY,
  // In production, you can also set the signing key for webhook verification
  ...(process.env.INNGEST_SIGNING_KEY && {
    signingKey: process.env.INNGEST_SIGNING_KEY,
  }),
});

