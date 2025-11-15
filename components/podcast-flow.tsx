"use client"

import React, { useCallback, useMemo, useEffect, useState } from "react"
import { useLingo } from "@/lib/lingo"
import { LanguageSwitcher } from "@/components/language-switcher"
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, MoreVertical, Globe, Volume2, Play, FileText, Link2, Trash2, Podcast, Download, FolderArchive, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

type StepStatus = "pending" | "processing" | "completed" | "error"

interface ProcessingStep {
  id: string
  label: string
  status: StepStatus
}

interface Chapter {
  id: string
  title: string
  content: string
  textContent: string
  wordCount: number
}

interface ChapterTranslation {
  title: string
  textContent: string
}

interface PodcastFlowProps {
  steps: ProcessingStep[]
  chapters: Chapter[]
  translations: Record<string, Record<string, ChapterTranslation>>
  audioUrls: Record<string, Record<string, string>>
  onTranslate: (chapterId: string, language: string) => Promise<void>
  onGenerateAudio: (chapterId: string, language: string, text: string) => Promise<string>
  isLoading: boolean
  onStartNew?: () => void
}

interface AudioUrlsMap {
  [chapterId: string]: {
    [language: string]: string
  }
}

interface MergeGroup {
  id: string
  audioNodes: Array<{ nodeId: string; chapterId: string; language: string }>
  language: string
}

const CHAPTER_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-300 dark:border-blue-700", label: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-300 dark:border-purple-700", label: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-300 dark:border-green-700", label: "text-green-700 dark:text-green-300" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-300 dark:border-orange-700", label: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-300 dark:border-pink-700", label: "text-pink-700 dark:text-pink-300" },
]

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "pt", name: "Português" },
]

function ChapterNode({
  data,
}: {
  data: {
    chapter: Chapter
    translations: Record<string, ChapterTranslation>
    audioUrls: Record<string, string>
    onTranslate: (chapterId: string, language: string) => Promise<void>
    onGenerateAudio: (chapterId: string, language: string) => Promise<string>
  }
}) {
  const { t } = useLingo()
  const { chapter, translations, audioUrls, onTranslate, onGenerateAudio } = data
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [isTranslating, setIsTranslating] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [currentAudioUrls, setCurrentAudioUrls] = useState(audioUrls)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const displayContent =
    selectedLanguage === "en"
      ? { title: chapter.title, textContent: chapter.textContent }
      : translations[selectedLanguage] || { title: chapter.title, textContent: chapter.textContent }

  const handleLanguageSelect = async (langCode: string) => {
    if (langCode === selectedLanguage) return
    
    if (!translations[langCode] && langCode !== "en") {
      setIsTranslating(true)
      try {
        await onTranslate(chapter.id, langCode)
        setSelectedLanguage(langCode)
      } catch (error) {
        console.error("Translation failed:", error)
      } finally {
        setIsTranslating(false)
      }
    } else {
      setSelectedLanguage(langCode)
    }
  }

  const handleGenerateAudio = async () => {
    if (currentAudioUrls[selectedLanguage]) {
      return
    }

    setIsGeneratingAudio(true)
    const toastId = toast.loading(`${t("Generating")} ${LANGUAGES.find(l => l.code === selectedLanguage)?.name} ${t("audio...")}`)
    
    try {
      const audioUrl = await onGenerateAudio(chapter.id, selectedLanguage, displayContent.textContent)
      setCurrentAudioUrls((prev) => ({ ...prev, [selectedLanguage]: audioUrl }))
      toast.success(t("Audio generated successfully!"), { id: toastId })
    } catch (error) {
      console.error("Audio generation failed:", error)
      toast.error(t("Failed to generate audio"), { id: toastId })
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  useEffect(() => {
    setCurrentAudioUrls(audioUrls)
  }, [audioUrls])

  const displayContentForDrawer =
    selectedLanguage === "en"
      ? { title: chapter.title, textContent: chapter.textContent }
      : translations[selectedLanguage] || { title: chapter.title, textContent: chapter.textContent }

  return (
    <>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      <Handle type="source" position={Position.Left} className="w-3 h-3" />
      <Handle type="source" position={Position.Right} className="w-3 h-3" />
      
      <div className={cn(
        "relative rounded-xl",
        isGeneratingAudio && "p-[2px]"
      )}>
        {isGeneratingAudio && (
          <div 
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: "linear-gradient(90deg, hsl(var(--muted-foreground)), hsl(var(--foreground)), hsl(var(--muted-foreground)))",
              backgroundSize: "200% 100%",
              animation: "gradient-shift 3s ease-in-out infinite, gradient-border 2s ease-in-out infinite",
              WebkitAnimation: "gradient-shift 3s ease-in-out infinite, gradient-border 2s ease-in-out infinite",
            }}
          />
        )}
        <Card className={cn(
          "w-72 p-4 border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow relative bg-card",
          isGeneratingAudio && "border-transparent"
        )}>
          <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{displayContent.title}</h3>
              <p className="text-xs text-muted-foreground">{chapter.wordCount} words</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-xs font-semibold">Languages</div>
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={cn(
                      "cursor-pointer",
                      selectedLanguage === lang.code && "bg-accent"
                    )}
                  >
                    <Globe className="h-3 w-3 mr-2" />
                    {lang.name}
                    {translations[lang.code] && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        ✓
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
                <div className="border-t my-1" />
                <DropdownMenuItem
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio || !!currentAudioUrls[selectedLanguage]}
                  className="cursor-pointer"
                >
                    <Volume2 className="h-3 w-3 mr-2" />
                    {isGeneratingAudio
                      ? t("Generating...")
                      : currentAudioUrls[selectedLanguage]
                        ? t("Audio Ready")
                        : t("Generate Audio")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
                <Button variant="outline" className="w-full" size="sm">
                  <FileText className="h-3 w-3 mr-2" />
                  {t("View Content")}
                </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh]">
              <DrawerHeader>
                <DrawerTitle>{displayContentForDrawer.title}</DrawerTitle>
                <DrawerDescription>
                  {chapter.wordCount} {t("words")} • {t("Language:")} {LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage.toUpperCase()}
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-4 overflow-y-auto">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {displayContentForDrawer.textContent}
                  </p>
                </div>
              </div>
              <DrawerFooter>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <Button
                      key={lang.code}
                      variant={selectedLanguage === lang.code ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        handleLanguageSelect(lang.code)
                      }}
                      disabled={isTranslating}
                    >
                      {lang.name}
                      {translations[lang.code] && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          ✓
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    onClick={async () => {
                      if (!currentAudioUrls[selectedLanguage]) {
                        await handleGenerateAudio()
                        setDrawerOpen(false)
                      }
                    }}
                    disabled={isGeneratingAudio || !!currentAudioUrls[selectedLanguage]}
                    className="flex-1"
                  >
                    {isGeneratingAudio ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("Generating...")}
                      </>
                    ) : currentAudioUrls[selectedLanguage] ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {t("Audio Available")}
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4 mr-2" />
                        {t("Generate Audio")}
                      </>
                    )}
                  </Button>
                  <DrawerClose asChild>
                    <Button variant="outline" className="flex-1">Close</Button>
                  </DrawerClose>
                </div>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          {isTranslating && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("Translating...")}
            </div>
          )}
          {currentAudioUrls[selectedLanguage] && (
            <Badge variant="outline" className="w-full justify-center">
              <Play className="h-3 w-3 mr-1" />
              {t("Audio Available")}
            </Badge>
          )}
          </div>
        </Card>
      </div>
    </>
  )
}

function AudioNode({ 
  data 
}: { 
  data: { 
    audioUrl: string
    language: string
    chapterId: string
    isSelected: boolean
    onToggleSelect: (nodeId: string) => void
    nodeId: string
    chapter?: Chapter
  } 
}) {
  const { t } = useLingo()
  const [dialogOpen, setDialogOpen] = useState(false)
  
  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = data.audioUrl
    link.download = `audio-${data.chapterId}-${data.language}.wav`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t("Audio download started!"))
  }

  const languageName = LANGUAGES.find(l => l.code === data.language)?.name || data.language.toUpperCase()

  return (
    <>
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <Handle type="source" position={Position.Right} className="w-2 h-2" />
      
      <div className="relative">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button
              className={cn(
                "relative w-16 h-16 rounded-full border border-border bg-card shadow-sm transition-all hover:shadow-md hover:scale-105 cursor-pointer",
                data.isSelected && "ring-2 ring-primary ring-offset-2"
              )}
              onClick={(e) => {
                // Don't open dialog if clicking checkbox area
                const target = e.target as HTMLElement
                if (target.closest('.checkbox-wrapper')) {
                  e.preventDefault()
                  e.stopPropagation()
                  return
                }
              }}
            >
              {/* Language square in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-muted rounded flex items-center justify-center border border-border">
                  <span className="text-foreground text-xs font-semibold">{data.language.toUpperCase()}</span>
                </div>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("Audio Player")}</DialogTitle>
              <DialogDescription>
                {data.chapter?.title || t("Chapter Audio")} • {languageName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Audio Player */}
              <div className="w-full">
                <audio controls className="w-full" src={data.audioUrl} preload="metadata">
                  {t("Your browser does not support the audio element.")}
                </audio>
              </div>
              
              {/* Audio Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("Language:")}</span>
                  <Badge variant="secondary">{languageName}</Badge>
                </div>
                {data.chapter && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("Chapter:")}</span>
                      <span className="font-medium">{data.chapter.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("Word Count:")}</span>
                      <span className="font-medium">{data.chapter.wordCount} {t("words")}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("Format:")}</span>
                  <span className="font-medium">WAV</span>
                </div>
              </div>

              {/* Download Button */}
              <Button onClick={handleDownload} className="w-full" variant="default">
                <Download className="h-4 w-4 mr-2" />
                {t("Download Audio")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Checkbox overlay - outside the Dialog */}
        <div
          className="absolute -top-1 -left-1 z-30 checkbox-wrapper cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            data.onToggleSelect(data.nodeId)
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          style={{ pointerEvents: 'auto' }}
        >
          <Checkbox 
            checked={data.isSelected}
            onCheckedChange={(checked) => {
              data.onToggleSelect(data.nodeId)
            }}
            className="h-4 w-4 border-2 border-foreground/60 bg-background"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
          />
        </div>
      </div>
    </>
  )
}

function MergeNode({ data }: { data: { group: MergeGroup; onRemoveGroup: (groupId: string) => void; audioUrls: AudioUrlsMap } }) {
  const { t } = useLingo()
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadMerged = async () => {
    setIsDownloading(true)
    const toastId = toast.loading(t("Merging audio files..."))

    try {
      // Get actual audio file paths from the URLs
      const audioFiles = data.group.audioNodes.map(node => {
        const audioUrl = data.audioUrls[node.chapterId]?.[node.language]
        if (!audioUrl) {
          throw new Error(`Audio not found for ${node.chapterId} - ${node.language}`)
        }
        // Extract filename from URL (/audio/filename.wav)
        return audioUrl.split('/').pop()
      }).filter(Boolean) as string[]

      console.log("Merging audio files:", audioFiles)
      
      const response = await fetch('/api/merge-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioFiles })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to merge audio files')
      }

      const result = await response.json()
      
      // Download the merged file
      const link = document.createElement('a')
      link.href = result.url
      link.download = `merged-podcast-${data.group.language}.wav`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(t("Merged audio download started!"), { id: toastId })
    } catch (error) {
      console.error("Download error:", error)
      toast.error(error instanceof Error ? error.message : t("Failed to download merged audio"), { id: toastId })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      
      <Card className="w-64 p-4 border shadow-sm bg-card bg-green-500/10 border-green-500/30">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">{t("Merge Group")}</p>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    disabled={isDownloading}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadMerged} disabled={isDownloading}>
                    <Download className="h-3 w-3 mr-2" />
                    {t("Download Merged")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => data.onRemoveGroup(data.group.id)}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Badge variant="default" className="w-fit">
            {data.group.language.toUpperCase()}
          </Badge>
          <div className="text-xs text-muted-foreground">
            {data.group.audioNodes.length} {data.group.audioNodes.length > 1 ? t("audios") : t("audio")} {t("audios to merge")}
          </div>
          <div className="flex flex-col gap-1">
            {data.group.audioNodes.map((audio, idx) => (
              <div key={audio.nodeId} className="text-xs bg-white dark:bg-gray-800 p-1 rounded">
                {idx + 1}. {t("Chapter")} {audio.chapterId.split('-').pop()}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  )
}

function ChapterGroupNode({ data }: { data: { chapterNumber: number; chapterTitle: string; audioCount: number; color: typeof CHAPTER_COLORS[0] } }) {
  return (
    <div className={cn(
      "w-full h-full rounded-xl border-2 border-dashed",
      data.color.bg,
      data.color.border
    )}>
      <div className={cn(
        "absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold",
        "bg-background border-2",
        data.color.border,
        data.color.label
      )}>
        Chapter {data.chapterNumber}
      </div>
      <div className="absolute top-2 right-4 flex items-center gap-2 opacity-60">
        <div className="text-xs text-muted-foreground">
          {data.audioCount} audio{data.audioCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  chapter: ChapterNode,
  audio: AudioNode,
  merge: MergeNode,
  chapterGroup: ChapterGroupNode,
}

export function PodcastFlow({
  steps,
  chapters,
  translations,
  audioUrls,
  onTranslate,
  onGenerateAudio,
  isLoading,
  onStartNew,
}: PodcastFlowProps) {
  const { t } = useLingo()
  const [selectedAudioNodes, setSelectedAudioNodes] = useState<Set<string>>(new Set())
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([])

  const toggleAudioSelection = useCallback((nodeId: string) => {
    setSelectedAudioNodes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  const createMergeGroup = useCallback(() => {
    if (selectedAudioNodes.size < 2) {
      toast.error(t("Please select at least 2 audio nodes to merge"))
      return
    }

    // Extract audio node info from selected nodes
    const audioNodesInfo = Array.from(selectedAudioNodes).map((nodeId) => {
      const parts = nodeId.split('-')
      const language = parts[parts.length - 1]
      const chapterId = parts.slice(1, -1).join('-')
      return { nodeId, chapterId, language }
    })

    // Check if all selected audios have the same language
    const languages = new Set(audioNodesInfo.map(a => a.language))
    if (languages.size > 1) {
      toast.error(t("All selected audios must be in the same language"))
      return
    }

    const language = audioNodesInfo[0].language
    const newGroup: MergeGroup = {
      id: `merge-${Date.now()}`,
      audioNodes: audioNodesInfo,
      language,
    }

    setMergeGroups((prev) => [...prev, newGroup])
    setSelectedAudioNodes(new Set())
    toast.success(`${t("Merge group created with")} ${audioNodesInfo.length} ${audioNodesInfo.length > 1 ? t("audios") : t("audio")}`)
  }, [selectedAudioNodes, t])

  const removeMergeGroup = useCallback((groupId: string) => {
    setMergeGroups((prev) => prev.filter(g => g.id !== groupId))
    toast.success(t("Merge group removed"))
  }, [t])

  const downloadAllSelected = useCallback(async () => {
    if (selectedAudioNodes.size < 1) {
      toast.error(t("Please select at least one audio to download"))
      return
    }

    const toastId = toast.loading(t("Preparing download..."))

    try {
      // Extract audio node info from selected nodes
      const audioNodesInfo = Array.from(selectedAudioNodes).map((nodeId) => {
        const parts = nodeId.split('-')
        const language = parts[parts.length - 1]
        const chapterId = parts.slice(1, -1).join('-')
        return { nodeId, chapterId, language }
      })

      // Get actual audio file paths
      const audioFiles = audioNodesInfo.map((node) => {
        const audioUrl = audioUrls[node.chapterId]?.[node.language]
        if (!audioUrl) {
          throw new Error(`Audio not found for ${node.chapterId} - ${node.language}`)
        }
        // Extract filename from URL (/audio/filename.wav)
        return audioUrl.split('/').pop()
      }).filter(Boolean) as string[]

      console.log("Zipping audio files:", audioFiles)

      const response = await fetch('/api/zip-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioFiles })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create zip file')
      }

      const result = await response.json()

      // Download the zip file
      const link = document.createElement('a')
      link.href = result.url
      link.download = `podcast-audios-${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(t("Download started!"), { id: toastId })
      setSelectedAudioNodes(new Set()) // Clear selection after download
    } catch (error) {
      console.error("Download error:", error)
      toast.error(error instanceof Error ? error.message : t("Failed to download audio files"), { id: toastId })
    }
  }, [selectedAudioNodes, audioUrls, t])

  const downloadAllAudios = useCallback(async () => {
    // Get all audio files from all chapters
    const allAudioFiles: string[] = []
    
    chapters.forEach((chapter) => {
      const chapterAudioUrls = audioUrls[chapter.id] || {}
      Object.values(chapterAudioUrls).forEach((audioUrl) => {
        if (audioUrl) {
          const filename = audioUrl.split('/').pop()
          if (filename) {
            allAudioFiles.push(filename)
          }
        }
      })
    })

    if (allAudioFiles.length === 0) {
      toast.error(t("No audio files available to download"))
      return
    }

    const toastId = toast.loading(t("Preparing download..."))

    try {
      console.log("Zipping all audio files:", allAudioFiles)

      const response = await fetch('/api/zip-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioFiles: allAudioFiles })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create zip file')
      }

      const result = await response.json()

      // Download the zip file
      const link = document.createElement('a')
      link.href = result.url
      link.download = `all-podcast-audios-${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(t("Download started!"), { id: toastId })
    } catch (error) {
      console.error("Download error:", error)
      toast.error(error instanceof Error ? error.message : t("Failed to download audio files"), { id: toastId })
    }
  }, [chapters, audioUrls, t])

  // Count total audio files
  const totalAudioCount = useMemo(() => {
    return chapters.reduce((count, chapter) => {
      const chapterAudioUrls = audioUrls[chapter.id] || {}
      return count + Object.keys(chapterAudioUrls).length
    }, 0)
  }, [chapters, audioUrls])

  const initialNodes = useMemo<Node[]>(() => {
    const nodes: Node[] = []

    if (chapters.length > 0) {
      const startY = 300
      const audioSpacing = 220
      const audioYOffset = 250
      const minSpacing = 50 // Minimum gap between chapter groups

      // First pass: calculate all group widths
      const groupWidths = chapters.map((chapter) => {
        const chapterAudioUrls = audioUrls[chapter.id] || {}
        const audioCount = Object.keys(chapterAudioUrls).length
        return Math.max(420, audioCount * audioSpacing + 180)
      })

      // Calculate positions based on actual widths to prevent overlaps
      let currentX = 0
      const groupPositions = groupWidths.map((width, index) => {
        const x = currentX + width / 2
        currentX += width + minSpacing
        return { x, width }
      })

      // Center all groups around the center point
      const totalWidth = currentX - minSpacing
      const centerX = 500
      const startX = centerX - totalWidth / 2

      chapters.forEach((chapter, index) => {
        const chapterAudioUrls = audioUrls[chapter.id] || {}
        const audioCount = Object.keys(chapterAudioUrls).length
        const color = CHAPTER_COLORS[index % CHAPTER_COLORS.length]
        
        // Add chapter group background node
        const { width: groupWidth } = groupPositions[index]
        const groupX = startX + groupPositions[index].x - groupWidth / 2
        const groupHeight = audioCount > 0 ? 550 : 280
        const groupY = startY - 40
        
        nodes.push({
          id: `group-${chapter.id}`,
          type: "chapterGroup",
          position: { x: groupX, y: groupY },
          style: { width: groupWidth, height: groupHeight },
          data: {
            chapterNumber: index + 1,
            chapterTitle: chapter.title,
            audioCount,
            color,
          },
        })
        
        // Position relative to group parent (parent's 0,0 is its top-left corner)
        const relativeX = groupWidth / 2 - 140 // Center horizontally in group
        const relativeY = 80
        
        nodes.push({
          id: `chapter-${chapter.id}`,
          type: "chapter",
          position: { x: relativeX, y: relativeY },
          parentId: `group-${chapter.id}`,
          extent: "parent",
          data: {
            chapter,
            translations: translations[chapter.id] || {},
            audioUrls: audioUrls[chapter.id] || {},
            onTranslate,
            onGenerateAudio,
          },
        })
        
        Object.entries(chapterAudioUrls).forEach(([language, audioUrl], audioIndex) => {
          const audioNodeId = `audio-${chapter.id}-${language}`
          // Position audios relative to group's (0,0) 
          const audioRelativeX = (groupWidth / 2) - ((audioCount - 1) * audioSpacing) / 2 + audioIndex * audioSpacing - 32 // Center audios in group (32 = half of 64px node width)
          const audioRelativeY = 360
          
          nodes.push({
            id: audioNodeId,
            type: "audio",
            position: { x: audioRelativeX, y: audioRelativeY },
            parentId: `group-${chapter.id}`,
            extent: "parent",
            data: { 
              audioUrl, 
              language, 
              chapterId: chapter.id,
              isSelected: selectedAudioNodes.has(audioNodeId),
              onToggleSelect: toggleAudioSelection,
              nodeId: audioNodeId,
              chapter,
            },
          })
        })
      })
      
      // Add merge nodes
      mergeGroups.forEach((group) => {
        const mergeY = startY + audioYOffset + 250
        const mergeX = 500
        nodes.push({
          id: group.id,
          type: "merge",
          position: { x: mergeX, y: mergeY },
          data: { group, onRemoveGroup: removeMergeGroup, audioUrls },
        })
      })
    }

    return nodes
  }, [chapters, translations, audioUrls, onTranslate, onGenerateAudio, selectedAudioNodes, toggleAudioSelection, mergeGroups, removeMergeGroup])

  const initialEdges = useMemo<Edge[]>(() => {
    const edges: Edge[] = []

    if (chapters.length > 0) {
      chapters.forEach((chapter) => {
        const chapterAudioUrls = audioUrls[chapter.id] || {}
        Object.entries(chapterAudioUrls).forEach(([language]) => {
          const audioNodeId = `audio-${chapter.id}-${language}`
          edges.push({
            id: `chapter-${chapter.id}-audio-${language}`,
            source: `chapter-${chapter.id}`,
            target: audioNodeId,
            type: "smoothstep",
            animated: true,
            style: { stroke: "hsl(150, 50%, 50%)", strokeWidth: 2, strokeDasharray: "4,4" },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "hsl(150, 50%, 50%)",
            },
          })
        })
      })
    }

      // Add edges from audio nodes to merge nodes
      mergeGroups.forEach((group) => {
        group.audioNodes.forEach((audioNode) => {
          edges.push({
            id: `audio-${audioNode.nodeId}-merge-${group.id}`,
            source: audioNode.nodeId,
            target: group.id,
            type: "smoothstep",
            animated: true,
            style: { stroke: "hsl(150, 50%, 50%)", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "hsl(150, 50%, 50%)",
            },
          })
        })
      })

    return edges
  }, [chapters, audioUrls, mergeGroups])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    // Recalculate positions to prevent overlaps when audio is added
    setNodes((currentNodes) => {
      const newNodes: Node[] = []

    if (chapters.length > 0) {
      const startY = 300
      const audioSpacing = 220
      const audioYOffset = 250
      const minSpacing = 50 // Minimum gap between chapter groups

      // First pass: calculate all group widths
      const groupWidths = chapters.map((chapter) => {
        const chapterAudioUrls = audioUrls[chapter.id] || {}
        const audioCount = Object.keys(chapterAudioUrls).length
        return Math.max(420, audioCount * audioSpacing + 180)
      })

      // Calculate positions based on actual widths to prevent overlaps
      let currentX = 0
      const groupPositions = groupWidths.map((width, index) => {
        const x = currentX + width / 2
        currentX += width + minSpacing
        return { x, width }
      })

      // Center all groups around the center point
      const totalWidth = currentX - minSpacing
      const centerX = 500
      const startX = centerX - totalWidth / 2

      chapters.forEach((chapter, index) => {
        const chapterAudioUrls = audioUrls[chapter.id] || {}
        const audioCount = Object.keys(chapterAudioUrls).length
        const color = CHAPTER_COLORS[index % CHAPTER_COLORS.length]
        
        // Add chapter group background node
        const { width: groupWidth } = groupPositions[index]
        const groupX = startX + groupPositions[index].x - groupWidth / 2
        const groupHeight = audioCount > 0 ? 550 : 280
        const groupY = startY - 60
        
        newNodes.push({
          id: `group-${chapter.id}`,
          type: "chapterGroup",
          position: { x: groupX, y: groupY },
          style: { width: groupWidth, height: groupHeight },
          data: {
            chapterNumber: index + 1,
            chapterTitle: chapter.title,
            audioCount,
            color,
          },
        })
        
        // Position relative to group parent (parent's 0,0 is its top-left corner)
        const relativeX = groupWidth / 2 - 140 // Center horizontally in group
        const relativeY = 80
        
        newNodes.push({
          id: `chapter-${chapter.id}`,
          type: "chapter",
          position: { x: relativeX, y: relativeY },
          parentId: `group-${chapter.id}`,
          extent: "parent",
          data: {
            chapter,
            translations: translations[chapter.id] || {},
            audioUrls: audioUrls[chapter.id] || {},
            onTranslate,
            onGenerateAudio,
          },
        })
        
        Object.entries(chapterAudioUrls).forEach(([language, audioUrl], audioIndex) => {
          const audioNodeId = `audio-${chapter.id}-${language}`
          // Position audios relative to group's (0,0) 
          const audioRelativeX = (groupWidth / 2) - ((audioCount - 1) * audioSpacing) / 2 + audioIndex * audioSpacing - 32 // Center audios in group (32 = half of 64px node width)
          const audioRelativeY = 360
          
          newNodes.push({
            id: audioNodeId,
            type: "audio",
            position: { x: audioRelativeX, y: audioRelativeY },
            parentId: `group-${chapter.id}`,
            extent: "parent",
            data: { 
              audioUrl, 
              language, 
              chapterId: chapter.id,
              isSelected: selectedAudioNodes.has(audioNodeId),
              onToggleSelect: toggleAudioSelection,
              nodeId: audioNodeId,
              chapter,
            },
          })
        })
      })
      
      // Add merge nodes
      mergeGroups.forEach((group) => {
        const mergeY = startY + audioYOffset + 250
        const mergeX = 500
        newNodes.push({
          id: group.id,
          type: "merge",
          position: { x: mergeX, y: mergeY },
          data: { group, onRemoveGroup: removeMergeGroup, audioUrls },
        })
      })
    }

      return newNodes
    })
  }, [chapters, translations, audioUrls, onTranslate, onGenerateAudio, setNodes, selectedAudioNodes, toggleAudioSelection, mergeGroups, removeMergeGroup])

  useEffect(() => {
    const newEdges: Edge[] = []

    if (chapters.length > 0) {
      chapters.forEach((chapter) => {
        const chapterAudioUrls = audioUrls[chapter.id] || {}
        Object.entries(chapterAudioUrls).forEach(([language]) => {
          const audioNodeId = `audio-${chapter.id}-${language}`
          newEdges.push({
            id: `chapter-${chapter.id}-audio-${language}`,
            source: `chapter-${chapter.id}`,
            target: audioNodeId,
            type: "smoothstep",
            animated: true,
            style: { stroke: "hsl(150, 50%, 50%)", strokeWidth: 2, strokeDasharray: "4,4" },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "hsl(150, 50%, 50%)",
            },
          })
        })
      })
      
      // Add edges from audio nodes to merge nodes
      mergeGroups.forEach((group) => {
        group.audioNodes.forEach((audioNode) => {
          newEdges.push({
            id: `audio-${audioNode.nodeId}-merge-${group.id}`,
            source: audioNode.nodeId,
            target: group.id,
            type: "smoothstep",
            animated: true,
            style: { stroke: "hsl(150, 50%, 50%)", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "hsl(150, 50%, 50%)",
            },
          })
        })
      })
    }

    setEdges(newEdges)
  }, [chapters, audioUrls, setEdges, mergeGroups])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      setTimeout(() => {
        const reactFlowInstance = document.querySelector('.react-flow') as any
        if (reactFlowInstance) {
          const flowElement = reactFlowInstance.closest('.react-flow__viewport')
          if (flowElement) {
            const fitViewBtn = document.querySelector('[data-testid="rf__controls-fitview"]') as HTMLElement
            if (fitViewBtn) {
              fitViewBtn.click()
            }
          }
        }
      }, 100)
    }
  }, [nodes.length, edges.length])

  return (
    <div className="w-full h-full relative">
      {/* App Logo and Title - Top Left */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5">
        <div className="p-1.5 rounded-md bg-muted/50 border border-border">
          <Podcast className="h-4 w-4 text-foreground" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-foreground leading-tight">
            {t("Podcastify")}
          </h1>
          <p className="text-xs text-muted-foreground leading-tight">{t("Blog to Podcast Converter")}</p>
        </div>
      </div>
      
      {/* Legend - Below Logo with spacing */}
      <div className="absolute top-16 left-4 z-10">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">{t("LEGEND")}</p>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-foreground/80" />
            <p className="text-xs text-muted-foreground">{t("Chapter Node")}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border border-border bg-card shadow-sm flex items-center justify-center">
              <div className="w-2 h-2 bg-muted rounded border border-border" />
            </div>
            <p className="text-xs text-muted-foreground">{t("Audio Node")}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
            <p className="text-xs text-muted-foreground">{t("Merge Group")}</p>
          </div>
        </div>
      </div>

      {/* Language Switcher - Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Top Center Buttons */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2">
        {onStartNew && (
          <Button
            variant="outline"
            size="icon"
            onClick={onStartNew}
            className="h-8 w-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        {totalAudioCount > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={downloadAllAudios}
            className="h-8 w-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            title={t("Download all audio files")}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {selectedAudioNodes.size > 0 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <Card className="p-4 shadow-xl border-2 border-blue-500 bg-background/95 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">
                  {selectedAudioNodes.size} {selectedAudioNodes.size > 1 ? t("audios") : t("audio")} {t("selected")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("Select audios with the same language to merge")}
                </p>
              </div>
              <Button
                onClick={downloadAllSelected}
                disabled={selectedAudioNodes.size < 1}
                size="sm"
                variant="secondary"
                className="gap-2"
              >
                <FolderArchive className="h-4 w-4" />
                {t("Download All")}
              </Button>
              <Button
                onClick={createMergeGroup}
                disabled={selectedAudioNodes.size < 2}
                size="sm"
                className="gap-2"
              >
                <Link2 className="h-4 w-4" />
                {t("Create Merge Group")}
              </Button>
              <Button
                onClick={() => setSelectedAudioNodes(new Set())}
                variant="outline"
                size="sm"
              >
                {t("Clear")}
              </Button>
            </div>
          </Card>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5, minZoom: 0.3 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background />
      </ReactFlow>
    </div>
  )
}

