import { NextRequest, NextResponse } from "next/server";
import { getJobsBySession, getJob } from "@/lib/jobs-store";

// GET /api/jobs?sessionId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const jobId = searchParams.get("jobId");

    if (jobId) {
      const job = getJob(jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      return NextResponse.json({ job });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId or jobId is required" },
        { status: 400 }
      );
    }

    const jobs = getJobsBySession(sessionId);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("[Jobs API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

