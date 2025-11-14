// In-memory job store (in production, use a database)
export interface AudioJob {
  id: string;
  sessionId: string;
  chapterId: string;
  language: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  audioUrl?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Store jobs in memory (will be lost on server restart)
// In production, use a database like PostgreSQL, MongoDB, or Redis
const jobsStore = new Map<string, AudioJob>();

export function createJob(sessionId: string, chapterId: string, language: string): AudioJob {
  const id = `${sessionId}-${chapterId}-${language}-${Date.now()}`;
  const job: AudioJob = {
    id,
    sessionId,
    chapterId,
    language,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  jobsStore.set(id, job);
  return job;
}

export function updateJob(id: string, updates: Partial<AudioJob>): AudioJob | null {
  const job = jobsStore.get(id);
  if (!job) return null;

  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: new Date(),
  };
  jobsStore.set(id, updatedJob);
  return updatedJob;
}

export function getJob(id: string): AudioJob | null {
  return jobsStore.get(id) || null;
}

export function getJobsBySession(sessionId: string): AudioJob[] {
  return Array.from(jobsStore.values())
    .filter((job) => job.sessionId === sessionId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function deleteJob(id: string): boolean {
  return jobsStore.delete(id);
}

export function clearOldJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let deleted = 0;
  
  for (const [id, job] of jobsStore.entries()) {
    if (now - job.createdAt.getTime() > maxAgeMs) {
      jobsStore.delete(id);
      deleted++;
    }
  }
  
  return deleted;
}

