/**
 * Horalix Halo - Speech Recognition Hook
 *
 * Real-time speech-to-text using Web Speech API (works in Chrome/Edge)
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface TranscriptSegment {
  id: string
  speaker: string
  text: string
  timestamp: number
  confidence?: number
}

interface UseSpeechRecognitionOptions {
  continuous?: boolean
  interimResults?: boolean
  lang?: string
  onSegment?: (segment: TranscriptSegment) => void
  onError?: (error: string) => void
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    continuous = true,
    interimResults = true,
    lang = 'en-US',
    onSegment,
    onError,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const segmentCounterRef = useRef(0)

  // Check if browser supports Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = continuous
      recognitionRef.current.interimResults = interimResults
      recognitionRef.current.lang = lang
      recognitionRef.current.maxAlternatives = 1

      // Handle results
      recognitionRef.current.onresult = (event: any) => {
        const last = event.results.length - 1
        const result = event.results[last]
        const transcript = result[0].transcript
        const confidence = result[0].confidence
        const isFinal = result.isFinal

        // Only process final results to avoid duplicate segments
        if (isFinal && transcript.trim()) {
          const segment: TranscriptSegment = {
            id: `segment_${Date.now()}_${segmentCounterRef.current++}`,
            speaker: 'You', // Web Speech API doesn't identify speakers
            text: transcript.trim(),
            timestamp: Date.now(),
            confidence,
          }

          onSegment?.(segment)
        }
      }

      // Handle errors
      recognitionRef.current.onerror = (event: any) => {
        console.error('[SpeechRecognition] Error:', event.error)

        if (event.error === 'no-speech') {
          // Ignore no-speech errors, they're expected in continuous mode
          return
        }

        if (event.error === 'aborted') {
          // Recognition was aborted, likely due to stopping
          return
        }

        onError?.(event.error)

        // Auto-restart on certain errors
        if (event.error === 'network' || event.error === 'audio-capture') {
          setTimeout(() => {
            if (isListening) {
              startListening()
            }
          }, 1000)
        }
      }

      // Handle end event - restart if continuous
      recognitionRef.current.onend = () => {
        if (isListening && continuous) {
          // Auto-restart in continuous mode
          try {
            recognitionRef.current.start()
          } catch (error) {
            console.error('[SpeechRecognition] Restart error:', error)
          }
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          // Ignore errors when stopping
        }
      }
    }
  }, [continuous, interimResults, lang, onSegment, onError])

  const startListening = useCallback(() => {
    if (!isSupported) {
      onError?.('Speech recognition not supported in this browser. Please use Chrome or Edge.')
      return
    }

    if (!recognitionRef.current) {
      onError?.('Speech recognition not initialized')
      return
    }

    try {
      recognitionRef.current.start()
      setIsListening(true)
      console.log('[SpeechRecognition] Started listening')
    } catch (error: any) {
      console.error('[SpeechRecognition] Start error:', error)
      if (error.message?.includes('already started')) {
        setIsListening(true)
      } else {
        onError?.(error.message)
      }
    }
  }, [isSupported, onError])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        setIsListening(false)
        console.log('[SpeechRecognition] Stopped listening')
      } catch (error: any) {
        console.error('[SpeechRecognition] Stop error:', error)
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  }
}
