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

  private static generateAudioKey(chapterId: string, language: string): string {
    const timestamp = Date.now()
    const extension = 'wav'
    return `audio/${chapterId}-${language}-${timestamp}.${extension}`
  }

  private static async checkExistingAudioVercel(
    chapterId: string, 
    language: string
  ): Promise<string | null> {
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

    if (!this.isVercelEnvironment()) {
      console.log('[Audio Storage] Using local storage (non-Vercel environment)')
      
      const existingUrl = await this.checkExistingAudioLocal(chapterId, language)
      if (existingUrl) {
        return {
          url: existingUrl,
          chapterId,
          language,
          cached: true
        }
      }

      const url = await this.saveToLocal(chapterId, language, audioBuffer, mimeType)
      return {
        url,
        chapterId,
        language,
        cached: false,
        size: audioBuffer.length
      }
    }

    console.log('[Audio Storage] Using Vercel Blob storage')
    
    const existingUrl = await this.checkExistingAudioVercel(chapterId, language)
    if (existingUrl) {
      return {
        url: existingUrl,
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

  static async getAudioInfo(chapterId: string, language: string): Promise<StoredAudioInfo | null> {
    if (!this.isVercelEnvironment()) {
      const url = await this.checkExistingAudioLocal(chapterId, language)
      if (url) {
        return {
          url,
          chapterId,
          language,
          cached: true
        }
      }
      return null
    }

    const url = await this.checkExistingAudioVercel(chapterId, language)
    if (url) {
      try {
        const blob = await head(url)
        return {
          url,
          chapterId,
          language,
          cached: true,
          size: blob.size,
          uploadedAt: blob.uploadedAt
        }
      } catch (error) {
        console.warn('[Blob Storage] Error getting blob info:', error)
        return {
          url,
          chapterId,
          language,
          cached: true
        }
      }
    }

    return null
  }

  static async listAllAudios(): Promise<string[]> {
    if (!this.isVercelEnvironment()) {
      const { readdir } = await import('fs/promises')
      const { join } = await import('path')
      const { existsSync } = await import('fs')

      const AUDIO_DIR = join(process.cwd(), "public", "audio")
      
      if (!existsSync(AUDIO_DIR)) {
        return []
      }

      try {
        const files = await readdir(AUDIO_DIR)
        return files
          .filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg') || file.endsWith('.m4a'))
          .map(file => `/audio/${file}`)
      } catch (error) {
        console.warn('[Local Storage] Error listing audio files:', error)
        return []
      }
    }

    try {
      const { blobs } = await list({
        prefix: 'audio/'
      })
      return blobs.map(blob => blob.url)
    } catch (error) {
      console.warn('[Blob Storage] Error listing audio files:', error)
      return []
    }
  }
}