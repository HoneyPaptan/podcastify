"use client"

import { useState, useEffect } from "react"
import { Activity, CheckCircle2, XCircle, Clock, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface AudioJob {
  id: string
  sessionId: string
  chapterId: string
  language: string
  status: "pending" | "processing" | "completed" | "failed"
  progress?: number
  audioUrl?: string
  error?: string
  createdAt: string
  updatedAt: string
}

interface JobsViewerProps {
  sessionId: string
}

export function JobsViewer({ sessionId }: JobsViewerProps) {
  const [jobs, setJobs] = useState<AudioJob[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchJobs = async () => {
    if (!sessionId) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/jobs?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchJobs()
      // Poll for updates every 3 seconds when panel is open
      const interval = setInterval(fetchJobs, 3000)
      return () => clearInterval(interval)
    }
  }, [isOpen, sessionId])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "processing":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const pendingOrProcessingCount = jobs.filter(
    (job) => job.status === "pending" || job.status === "processing"
  ).length

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
          title="View Background Jobs"
        >
          <div className="relative">
            <Activity className="h-5 w-5" />
            {pendingOrProcessingCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center animate-pulse">
                {pendingOrProcessingCount}
              </span>
            )}
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Background Jobs</SheetTitle>
          <SheetDescription>
            Audio generation jobs for this session
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6">
          {isLoading && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">No background jobs yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start generating audio to see jobs here
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3 pr-4">
                {jobs.map((job) => (
                  <Card key={job.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5">{getStatusIcon(job.status)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">
                              Chapter: {job.chapterId}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {job.language.toUpperCase()}
                            </Badge>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", getStatusColor(job.status))}
                          >
                            {job.status}
                          </Badge>
                          {job.error && (
                            <p className="text-xs text-red-500 mt-2 line-clamp-2">
                              {job.error}
                            </p>
                          )}
                          {job.audioUrl && (
                            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Audio ready
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

