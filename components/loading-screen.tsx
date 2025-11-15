"use client"

import { Loader2, CheckCircle2, Circle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type StepStatus = "pending" | "processing" | "completed" | "error"

interface LoadingStep {
  id: string
  label: string
  status: StepStatus
}

interface LoadingScreenProps {
  steps: LoadingStep[]
}

export function LoadingScreen({ steps }: LoadingScreenProps) {
  return (
    <div className="relative z-10 w-full max-w-md mx-auto">
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Creating your podcast
          </h2>
          <p className="text-sm text-muted-foreground">
            This may take a few moments
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-3 p-4 rounded-lg border bg-card/50 backdrop-blur-sm"
            >
              <div className="flex-shrink-0">
                {step.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : step.status === "processing" ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : step.status === "error" ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.status === "completed"
                      ? "text-foreground"
                      : step.status === "processing"
                      ? "text-foreground"
                      : step.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.status === "processing" && (
                  <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
