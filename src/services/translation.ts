/**
 * Horalix Halo - Real-time Translation Service
 *
 * Provides real-time translation using LibreTranslate API
 * Falls back to browser translate API if available
 */

export interface TranslationResult {
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  confidence?: number
}

export class TranslationService {
  private apiUrl: string
  private apiKey: string | null

  constructor(apiUrl: string = 'https://libretranslate.com/translate', apiKey: string | null = null) {
    this.apiUrl = apiUrl
    this.apiKey = apiKey
  }

  /**
   * Translate text to target language
   */
  async translate(
    text: string,
    targetLang: string,
    sourceLang: string = 'auto'
  ): Promise<TranslationResult> {
    if (!text.trim()) {
      return {
        translatedText: '',
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      }
    }

    try {
      // Try LibreTranslate API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          api_key: this.apiKey || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return {
          translatedText: data.translatedText || text,
          sourceLanguage: data.detectedLanguage?.language || sourceLang,
          targetLanguage: targetLang,
          confidence: data.detectedLanguage?.confidence,
        }
      }
    } catch (error) {
      console.error('[Translation] LibreTranslate error:', error)
    }

    // Fallback: Return original text if translation fails
    console.warn('[Translation] Translation failed, returning original text')
    return {
      translatedText: text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl.replace('/translate', '/detect')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          api_key: this.apiKey || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.length > 0) {
          return data[0].language || 'en'
        }
      }
    } catch (error) {
      console.error('[Translation] Language detection error:', error)
    }

    return 'en' // Default to English
  }

  /**
   * Get list of supported languages
   */
  async getSupportedLanguages(): Promise<Array<{ code: string; name: string }>> {
    try {
      const response = await fetch(`${this.apiUrl.replace('/translate', '/languages')}`, {
        method: 'GET',
      })

      if (response.ok) {
        const data = await response.json()
        return data.map((lang: any) => ({
          code: lang.code,
          name: lang.name,
        }))
      }
    } catch (error) {
      console.error('[Translation] Failed to get supported languages:', error)
    }

    // Return common languages as fallback
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
    ]
  }
}

// Singleton instance
export const translationService = new TranslationService()

/**
 * Batch translate multiple texts efficiently
 */
export async function batchTranslate(
  texts: string[],
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<TranslationResult[]> {
  const results = await Promise.all(
    texts.map((text) => translationService.translate(text, targetLang, sourceLang))
  )
  return results
}

/**
 * Real-time translation stream for continuous text
 */
export class TranslationStream {
  private service: TranslationService
  private targetLang: string
  private sourceLang: string
  private pendingTexts: string[] = []
  private isProcessing: boolean = false

  constructor(targetLang: string, sourceLang: string = 'auto') {
    this.service = new TranslationService()
    this.targetLang = targetLang
    this.sourceLang = sourceLang
  }

  /**
   * Add text to translation queue
   */
  async addText(text: string): Promise<TranslationResult | null> {
    if (!text.trim()) return null

    this.pendingTexts.push(text)
    return this.processQueue()
  }

  /**
   * Process translation queue
   */
  private async processQueue(): Promise<TranslationResult | null> {
    if (this.isProcessing || this.pendingTexts.length === 0) {
      return null
    }

    this.isProcessing = true

    const text = this.pendingTexts.shift()!
    const result = await this.service.translate(text, this.targetLang, this.sourceLang)

    this.isProcessing = false

    // Continue processing if more items in queue
    if (this.pendingTexts.length > 0) {
      this.processQueue()
    }

    return result
  }

  /**
   * Change target language
   */
  setTargetLanguage(lang: string) {
    this.targetLang = lang
  }

  /**
   * Clear pending translations
   */
  clear() {
    this.pendingTexts = []
  }
}
