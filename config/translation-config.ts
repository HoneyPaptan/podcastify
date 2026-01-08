export const TRANSLATION_CONFIG = {
  // Cache duration in milliseconds (7 days)
  CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
  
  // Maximum cache size in bytes (5MB)
  MAX_CACHE_SIZE: 5 * 1024 * 1024,
  
  // Enable automatic component change detection
  AUTO_INVALIDATION: true,
  
  // Enable background cache validation
  BACKGROUND_VALIDATION: true,
  
  // Debug mode for development
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  
  // Cache key prefixes
  CACHE_KEYS: {
    UI_TRANSLATIONS: 'podcastify_ui_translations',
    COMPONENT_HASHES: 'podcastify_component_hashes',
    TRANSLATION_VERSION: 'podcastify_translation_version',
  },
  
  // Current version of the translation system
  TRANSLATION_VERSION: '1.0.0',
  
  // Performance metrics tracking
  TRACK_METRICS: process.env.NODE_ENV === 'development',
  
  // Fallback to API if cache fails
  FALLBACK_TO_API: true,
  
  // Minimum time between API calls for same content (in milliseconds)
  API_COOLDOWN: 1000,
  
  // Maximum retry attempts for failed translations
  MAX_RETRY_ATTEMPTS: 3,
} as const

// Helper function to check if debug mode is enabled
export const isDebugMode = (): boolean => {
  return TRANSLATION_CONFIG.DEBUG_MODE
}

// Helper function to log debug messages
export const debugLog = (message: string, ...args: any[]): void => {
  if (isDebugMode()) {
    console.log(`[Translation Debug] ${message}`, ...args)
  }
}

// Helper function to log performance metrics
export const logPerformance = (operation: string, duration: number): void => {
  if (TRANSLATION_CONFIG.TRACK_METRICS) {
    console.log(`[Translation Performance] ${operation}: ${duration}ms`)
  }
}