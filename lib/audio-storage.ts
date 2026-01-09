import { put, head, list } from '@vercel/blob'

export interface AudioStorageOptions {
  chapterId: string
  language: string
  audioBuffer: Buffer
  mimeType?: string
}

export interface StoredAudioInfo {
  url: string
  chapterId: string
  language: string
  cached: boolean
  size?: number
  uploadedAt?: Date
}

export class AudioStorageManager {
  private static isVercelEnvironment(): boolean {
    return process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined
  }

  private static hasBlobToken(): boolean {
    return !!process.env.BLOB_READ_WRITE_TOKEN
  }

  private static generateAudioKey(chapterId: string, language: string): string {
    const timestamp = Date.now()
    const extension = 'wav'
    return `audio/${chapterId}-${language}-${timestamp}.${extension}`
  }

  private static async checkExistingAudioVercel(
    chapterId: string, 
    language: string
  ): Promise<string | null> {
    if (!this.hasBlobToken()) {
      console.log('[Blob Storage] No BLOB_READ_WRITE_TOKEN, skipping blob check')
      return null
    }

    try {
      const { blobs } = await list({
        prefix: `audio/${chapterId}-${language}-`,
        limit: 1
      })

      if (blobs.length > 0) {
        console.log(`[Blob Storage] Found existing audio: ${blobs[0].url}`)
        return blobs[0].url
      }
    } catch (error) {
      console.warn('[Blob Storage] Error checking existing audio:', error)
    }
    
    return null
  }

  private static async checkExistingAudioLocal(
    chapterId: string, 
    language: string
  ): Promise<string | null> {
    const { readFile, readdir } = await import('fs/promises')
    const { join } = await import('path')
    const { existsSync } = await import('fs')

    const AUDIO_DIR = join(process.cwd(), "public", "audio")
    
    if (!existsSync(AUDIO_DIR)) {
      return null
    }

    try {
      const existingFiles = await readdir(AUDIO_DIR)
      const existingFile = existingFiles.find((file: string) => 
        file.startsWith(`${chapterId}-${language}-`) && 
        (file.endsWith(".mp3") || file.endsWith(".wav") || file.endsWith(".ogg") || file.endsWith(".m4a"))
      )

      if (existingFile) {
        console.log(`[Local Storage] Found existing audio: ${existingFile}`)
        return `/audio/${existingFile}`
      }
    } catch (error) {
      console.warn('[Local Storage] Error checking existing audio:', error)
    }

    return null
  }

  private static async saveToVercelBlob(
    chapterId: string,
    language: string, 
    audioBuffer: Buffer,
    mimeType: string = 'audio/wav'
  ): Promise<string> {
    if (!this.hasBlobToken()) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required for Vercel Blob storage')
    }

    const key = this.generateAudioKey(chapterId, language)
    
    try {
      const blob = await put(key, audioBuffer, {
        access: 'public',
        contentType: mimeType,
      })

      console.log(`[Blob Storage] Uploaded audio: ${blob.url}, size: ${audioBuffer.length} bytes`)
      return blob.url
    } catch (error) {
      console.error('[Blob Storage] Error uploading to Vercel Blob:', error)
      throw new Error(`Failed to upload audio to Vercel Blob: ${error}`)
    }
  }

  private static async saveToLocal(
    chapterId: string,
    language: string,
    audioBuffer: Buffer,
    mimeType: string = 'audio/wav'
  ): Promise<string> {
    const { writeFile, mkdir } = await import('fs/promises')
    const { join } = await import('path')
    const { existsSync } = await import('fs')

    const AUDIO_DIR = join(process.cwd(), "public", "audio")
    
    if (!existsSync(AUDIO_DIR)) {
      await mkdir(AUDIO_DIR, { recursive: true })
    }

    const audioFileName = `${chapterId}-${language}-${Date.now()}.wav`
    const audioPath = join(AUDIO_DIR, audioFileName)
    
    await writeFile(audioPath, audioBuffer)
    console.log(`[Local Storage] Saved audio: ${audioPath}, size: ${audioBuffer.length} bytes`)
    
    return `/audio/${audioFileName}`
  }

  static async storeAudio(options: AudioStorageOptions): Promise<StoredAudioInfo> {
    const { chapterId, language, audioBuffer, mimeType = 'audio/wav' } = options

    // Always check local cache first
    const existingLocalUrl = await this.checkExistingAudioLocal(chapterId, language)
    if (existingLocalUrl) {
      console.log('[Audio Storage] Using cached local file')
      return {
        url: existingLocalUrl,
        chapterId,
        language,
        cached: true
      }
    }

    // If in Vercel environment with token, use Blob storage
    if (this.isVercelEnvironment() && this.hasBlobToken()) {
      console.log('[Audio Storage] Using Vercel Blob storage')
      
      const existingBlobUrl = await this.checkExistingAudioVercel(chapterId, language)
      if (existingBlobUrl) {
        return {
          url: existingBlobUrl,
          chapterId,
          language,
          cached: true
        }
      }

      const url = await this.saveToVercelBlob(chapterId, language, audioBuffer, mimeType)
      return {
        url,
        chapterId,
        language,
        cached: false,
        size: audioBuffer.length,
        uploadedAt: new Date()
      }
    }

    // Fallback to local storage
    console.log('[Audio Storage] Using local storage (fallback)')
    const url = await this.saveToLocal(chapterId, language, audioBuffer, mimeType)
    return {
      url,
      chapterId,
      language,
      cached: false,
      size: audioBuffer.length
    }
  }

  static async getAudioInfo(chapterId: string, language: string): Promise<StoredAudioInfo | null> {
    // Always check local cache first
    const localUrl = await this.checkExistingAudioLocal(chapterId, language)
    if (localUrl) {
      return {
        url: localUrl,
        chapterId,
        language,
        cached: true
      }
    }

    // If in Vercel environment with token, check blob storage
    if (this.isVercelEnvironment() && this.hasBlobToken()) {
      const blobUrl = await this.checkExistingAudioVercel(chapterId, language)
      if (blobUrl) {
        try {
          const blob = await head(blobUrl)
          return {
            url: blobUrl,
            chapterId,
            language,
            cached: true,
            size: blob.size,
            uploadedAt: blob.uploadedAt
          }
        } catch (error) {
          console.warn('[Blob Storage] Error getting blob info:', error)
          return {
            url: blobUrl,
            chapterId,
            language,
            cached: true
          }
        }
      }
    }

    return null
  }

  static async listAllAudios(): Promise<string[]> {
    const allUrls: string[] = []

    // Always check local files first
    const { readdir } = await import('fs/promises')
    const { join } = await import('path')
    const { existsSync } = await import('fs')

    const AUDIO_DIR = join(process.cwd(), "public", "audio")
    
    if (existsSync(AUDIO_DIR)) {
      try {
        const files = await readdir(AUDIO_DIR)
        const localUrls = files
          .filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg') || file.endsWith('.m4a'))
          .map(file => `/audio/${file}`)
        allUrls.push(...localUrls)
      } catch (error) {
        console.warn('[Local Storage] Error listing audio files:', error)
      }
    }

    // If in Vercel environment with token, also list blob files
    if (this.isVercelEnvironment() && this.hasBlobToken()) {
      try {
        const { blobs } = await list({
          prefix: 'audio/'
        })
        const blobUrls = blobs.map(blob => blob.url)
        allUrls.push(...blobUrls)
      } catch (error) {
        console.warn('[Blob Storage] Error listing audio files:', error)
      }
    }

    // Remove duplicates
    return [...new Set(allUrls)]
  }
}