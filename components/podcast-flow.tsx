"use client"

import React, { useCallback, useMemo, useEffect, useState } from "react"
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
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
import { Loader2, MoreVertical, Globe, Volume2, Play, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
}

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
    onGenerateAudio: (chapterId: string, language: string, text: string) => Promise<string>
  }
}) {
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
    const toastId = toast.loading(`Generating ${LANGUAGES.find(l => l.code === selectedLanguage)?.name} audio...`)
    
    try {
      const audioUrl = await onGenerateAudio(chapter.id, selectedLanguage, displayContent.textContent)
      setCurrentAudioUrls((prev) => ({ ...prev, [selectedLanguage]: audioUrl }))
      toast.success(`Audio generated successfully!`, { id: toastId })
    } catch (error) {
      console.error("Audio generation failed:", error)
      toast.error("Failed to generate audio", { id: toastId })
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
      
      <Card className="w-72 p-4 border-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow">
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
                    ? "Generating..."
                    : currentAudioUrls[selectedLanguage]
                      ? "Audio Ready"
                      : "Generate Audio"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" className="w-full" size="sm">
                <FileText className="h-3 w-3 mr-2" />
                View Content
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh]">
              <DrawerHeader>
                <DrawerTitle>{displayContentForDrawer.title}</DrawerTitle>
                <DrawerDescription>
                  {chapter.wordCount} words • Language: {LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage.toUpperCase()}
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
                <DrawerClose asChild>
                  <Button variant="outline">Close</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          {isTranslating && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Translating...
            </div>
          )}
          {currentAudioUrls[selectedLanguage] && (
            <Badge variant="outline" className="w-full justify-center">
              <Play className="h-3 w-3 mr-1" />
              Audio Available
            </Badge>
          )}
        </div>
      </Card>
    </>
  )
}

function AudioNode({ data }: { data: { audioUrl: string; language: string } }) {
  return (
    <>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      <Handle type="target" position={Position.Left} className="w-3 h-3" />
      <Handle type="target" position={Position.Right} className="w-3 h-3" />
      
      <Card className="w-48 p-4 border-2 shadow-lg bg-primary/5">
        <div className="flex flex-col items-center gap-2">
        <Volume2 className="h-6 w-6 text-primary" />
        <p className="text-xs font-semibold">Audio</p>
        <Badge variant="secondary" className="text-xs">
          {data.language.toUpperCase()}
        </Badge>
        <audio controls className="w-full h-8" src={data.audioUrl} preload="metadata">
          Your browser does not support the audio element.
        </audio>
      </div>
    </Card>
    </>
  )
}

const nodeTypes: NodeTypes = {
  chapter: ChapterNode,
  audio: AudioNode,
}

export function PodcastFlow({
  steps,
  chapters,
  translations,
  audioUrls,
  onTranslate,
  onGenerateAudio,
  isLoading,
}: PodcastFlowProps) {
  const initialNodes = useMemo<Node[]>(() => {
    const nodes: Node[] = []

    if (chapters.length > 0) {
      const centerX = 500
      const startY = 300
      const chapterSpacing = 350
      const audioSpacing = 220
      const audioYOffset = 250

      chapters.forEach((chapter, index) => {
        const x = centerX + (index - (chapters.length - 1) / 2) * chapterSpacing
        nodes.push({
          id: `chapter-${chapter.id}`,
          type: "chapter",
          position: { x, y: startY },
          data: {
            chapter,
            translations: translations[chapter.id] || {},
            audioUrls: audioUrls[chapter.id] || {},
            onTranslate,
            onGenerateAudio,
          },
        })

        const chapterAudioUrls = audioUrls[chapter.id] || {}
        const audioCount = Object.keys(chapterAudioUrls).length
        const audioStartX = x - ((audioCount - 1) * audioSpacing) / 2
        
        Object.entries(chapterAudioUrls).forEach(([language, audioUrl], audioIndex) => {
          const audioNodeId = `audio-${chapter.id}-${language}`
          nodes.push({
            id: audioNodeId,
            type: "audio",
            position: { x: audioStartX + audioIndex * audioSpacing, y: startY + audioYOffset },
            data: { audioUrl, language },
          })
        })
      })
    }

    return nodes
  }, [chapters, translations, audioUrls, onTranslate, onGenerateAudio])

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
            style: { stroke: "#10b981", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#10b981",
            },
          })
        })
      })
    }

    return edges
  }, [chapters, audioUrls])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    const newNodes: Node[] = []

    if (chapters.length > 0) {
      const centerX = 500
      const startY = 300
      const chapterSpacing = 350
      const audioSpacing = 220
      const audioYOffset = 250

      chapters.forEach((chapter, index) => {
        const x = centerX + (index - (chapters.length - 1) / 2) * chapterSpacing
        newNodes.push({
          id: `chapter-${chapter.id}`,
          type: "chapter",
          position: { x, y: startY },
          data: {
            chapter,
            translations: translations[chapter.id] || {},
            audioUrls: audioUrls[chapter.id] || {},
            onTranslate,
            onGenerateAudio,
          },
        })

        const chapterAudioUrls = audioUrls[chapter.id] || {}
        const audioCount = Object.keys(chapterAudioUrls).length
        const audioStartX = x - ((audioCount - 1) * audioSpacing) / 2
        
        Object.entries(chapterAudioUrls).forEach(([language, audioUrl], audioIndex) => {
          const audioNodeId = `audio-${chapter.id}-${language}`
          newNodes.push({
            id: audioNodeId,
            type: "audio",
            position: { x: audioStartX + audioIndex * audioSpacing, y: startY + audioYOffset },
            data: { audioUrl, language },
          })
        })
      })
    }

    setNodes(newNodes)
  }, [chapters, translations, audioUrls, onTranslate, onGenerateAudio, setNodes])

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
            style: { stroke: "#10b981", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#10b981",
            },
          })
        })
      })
    }

    setEdges(newEdges)
  }, [chapters, audioUrls, setEdges])

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
    <div className="w-full h-full">
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
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

