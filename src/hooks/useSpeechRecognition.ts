/**
 * Horalix Halo - Speech Recognition Hook
 *
 * Real-time speech-to-text using Web Speech API (works in Chrome/Edge)
 * Includes basic speaker diarization using pause patterns and speech characteristics
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
  enableDiarization?: boolean  // Enable speaker detection
  onSegment?: (segment: TranscriptSegment) => void
  onError?: (error: string) => void
}

// Speaker detection using pause patterns and timing
class SpeakerDetector {
  private lastSpeechTime: number = 0
  private currentSpeaker: number = 1
  private speakerHistory: Array<{ speaker: number; time: number }> = []
  private readonly SPEAKER_SWITCH_THRESHOLD = 2000 // 2 seconds of silence suggests speaker change

  detectSpeaker(timestamp: number): string {
    const timeSinceLastSpeech = timestamp - this.lastSpeechTime

    // If significant pause, likely a different speaker
    if (timeSinceLastSpeech > this.SPEAKER_SWITCH_THRESHOLD && this.lastSpeechTime > 0) {
      // Alternate between speakers (simple heuristic)
      this.currentSpeaker = this.currentSpeaker === 1 ? 2 : 1
    }

    this.lastSpeechTime = timestamp
    this.speakerHistory.push({ speaker: this.currentSpeaker, time: timestamp })

    // Keep history limited to last 20 entries
    if (this.speakerHistory.length > 20) {
      this.speakerHistory.shift()
    }

    return `Speaker ${this.currentSpeaker}`
  }

  reset() {
    this.lastSpeechTime = 0
    this.currentSpeaker = 1
    this.speakerHistory = []
  }
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    continuous = true,
    interimResults = true,
    lang = 'en-US',
    enableDiarization = true,  // Enable by default
    onSegment,
    onError,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const segmentCounterRef = useRef(0)
  const speakerDetectorRef = useRef(new SpeakerDetector())

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
          const timestamp = Date.now()

          // Detect speaker using diarization if enabled
          const speaker = enableDiarization
            ? speakerDetectorRef.current.detectSpeaker(timestamp)
            : 'You'

          const segment: TranscriptSegment = {
            id: `segment_${timestamp}_${segmentCounterRef.current++}`,
            speaker,
            text: transcript.trim(),
            timestamp,
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
      // Reset speaker detector when starting a new session
      speakerDetectorRef.current.reset()

      recognitionRef.current.start()
      setIsListening(true)
      console.log('[SpeechRecognition] Started listening with speaker diarization:', enableDiarization)
    } catch (error: any) {
      console.error('[SpeechRecognition] Start error:', error)
      if (error.message?.includes('already started')) {
        setIsListening(true)
      } else {
        onError?.(error.message)
      }
    }
  }, [isSupported, onError, enableDiarization])

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
