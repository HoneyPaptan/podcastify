import { TRANSLATION_CONFIG, debugLog } from '@/config/translation-config'

/**
 * Simple hash function for strings
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

/**
 * Generate a hash for the current UI keys configuration
 */
export function generateComponentHash(uiKeys: string[]): string {
  const sortedKeys = [...uiKeys].sort()
  const combinedString = sortedKeys.join('|')
  const hash = simpleHash(combinedString)
  debugLog('Generated component hash', { hash, keyCount: uiKeys.length })
  return hash
}

/**
 * Get stored component hashes from localStorage
 */
export function getStoredComponentHashes(): Record<string, string> {
  try {
    const stored = localStorage.getItem(TRANSLATION_CONFIG.CACHE_KEYS.COMPONENT_HASHES)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    debugLog('Error reading component hashes from localStorage:', error)
    return {}
  }
}

/**
 * Save component hashes to localStorage
 */
export function setComponentHashes(hashes: Record<string, string>): void {
  try {
    localStorage.setItem(
      TRANSLATION_CONFIG.CACHE_KEYS.COMPONENT_HASHES,
      JSON.stringify(hashes)
    )
    debugLog('Saved component hashes', hashes)
  } catch (error) {
    debugLog('Error saving component hashes to localStorage:', error)
  }
}

/**
 * Check if UI components have changed since last cache
 */
export function hasComponentsChanged(currentUIKeys: string[]): boolean {
  // Only run on client side to prevent SSR mismatches
  if (typeof window === 'undefined' || !TRANSLATION_CONFIG.AUTO_INVALIDATION) {
    return false
  }

  const currentHash = generateComponentHash(currentUIKeys)
  const storedHashes = getStoredComponentHashes()
  const lastHash = storedHashes['ui_keys']
  
  const hasChanged = lastHash !== currentHash
  debugLog('Component change detection', { 
    currentHash, 
    lastHash, 
    hasChanged 
  })
  
  return hasChanged
}

/**
 * Update the stored component hash after successful translation
 */
export function updateComponentHash(uiKeys: string[]): void {
  const currentHash = generateComponentHash(uiKeys)
  const storedHashes = getStoredComponentHashes()
  storedHashes['ui_keys'] = currentHash
  setComponentHashes(storedHashes)
}

/**
 * Clear all component hashes (for cache invalidation)
 */
export function clearComponentHashes(): void {
  try {
    localStorage.removeItem(TRANSLATION_CONFIG.CACHE_KEYS.COMPONENT_HASHES)
    debugLog('Cleared component hashes')
  } catch (error) {
    debugLog('Error clearing component hashes:', error)
  }
}

/**
 * Get the current translation version
 */
export function getCurrentTranslationVersion(): string {
  return TRANSLATION_CONFIG.TRANSLATION_VERSION
}

/**
 * Get the stored translation version
 */
export function getStoredTranslationVersion(): string | null {
  try {
    return localStorage.getItem(TRANSLATION_CONFIG.CACHE_KEYS.TRANSLATION_VERSION)
  } catch (error) {
    debugLog('Error reading translation version:', error)
    return null
  }
}

/**
 * Update the stored translation version
 */
export function updateTranslationVersion(): void {
  try {
    localStorage.setItem(
      TRANSLATION_CONFIG.CACHE_KEYS.TRANSLATION_VERSION,
      TRANSLATION_CONFIG.TRANSLATION_VERSION
    )
    debugLog('Updated translation version', TRANSLATION_CONFIG.TRANSLATION_VERSION)
  } catch (error) {
    debugLog('Error updating translation version:', error)
  }
}

/**
 * Check if translation version has changed
 */
export function hasTranslationVersionChanged(): boolean {
  // Only run on client side to prevent SSR mismatches
  if (typeof window === 'undefined') {
    return false
  }

  const currentVersion = getCurrentTranslationVersion()
  const storedVersion = getStoredTranslationVersion()
  
  const hasChanged = storedVersion !== currentVersion
  debugLog('Translation version change detection', { 
    currentVersion, 
    storedVersion, 
    hasChanged 
  })
  
  return hasChanged
}