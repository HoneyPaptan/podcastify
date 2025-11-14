"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, Loader2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProcessingStep {
  id: string
  label: string
  status: "pending" | "processing" | "completed" | "error"
}

interface ProcessingStatusProps {
  steps: ProcessingStep[]
}

export function ProcessingStatus({ steps }: ProcessingStatusProps) {
  return (
    <Card className="border-2">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {step.status === "completed" && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                {step.status === "processing" && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {step.status === "error" && (
                  <Circle className="h-5 w-5 text-destructive" />
                )}
                {step.status === "pending" && (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.status === "completed" && "text-green-600",
                    step.status === "processing" && "text-primary",
                    step.status === "error" && "text-destructive",
                    step.status === "pending" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.status === "processing" && (
                  <Skeleton className="mt-2 h-1 w-full" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

