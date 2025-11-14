/**
 * Horalix Halo - Meeting Page
 *
 * Complete meeting interface with transcription, controls, and AI assistance.
 */

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useSubscription, useCanStartMeeting } from "../../contexts/SubscriptionContext"
import { MeetingControls } from "./MeetingControls"
import { MeetingTimer } from "./MeetingTimer"
import { UsageIndicator } from "../subscription/UsageIndicator"
import { useSpeechRecognition, TranscriptSegment } from "../../hooks/useSpeechRecognition"

// ============================================================================
// TYPES
// ============================================================================

interface MeetingPageProps {
  onEndMeeting?: () => void
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MeetingPage: React.FC<MeetingPageProps> = ({ onEndMeeting }) => {
  const { planConfig, refresh } = useSubscription()
  const canStart = useCanStartMeeting()

  const [meetingId] = useState(() => `meeting_${Date.now()}`)
  const [isActive, setIsActive] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([])
  const [fullTranscriptText, setFullTranscriptText] = useState("")
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)

  // Real-time speech recognition
  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onSegment: (segment) => {
      setTranscript((prev) => [...prev, segment])
      setFullTranscriptText((prev) => prev + " " + segment.text)
    },
    onError: (error) => {
      setTranscriptionError(error)
      console.error('[MeetingPage] Transcription error:', error)
    },
  })

  // ============================================================================
  // MEETING CONTROLS
  // ============================================================================

  const handleStartMeeting = async () => {
    if (!canStart.allowed) {
      alert(canStart.reason || "Cannot start meeting")
      return
    }

    // Check if speech recognition is supported
    if (!isSupported) {
      const proceed = confirm(
        "Real-time transcription requires Chrome or Edge browser. Would you like to continue with demo mode?"
      )
      if (!proceed) return
    }

    setIsActive(true)
    setStartedAt(Date.now())
    setTranscriptionError(null)

    // Start real transcription
    if (isSupported) {
      startListening()
      console.log("[MeetingPage] Real transcription started")
    }

    console.log("[MeetingPage] Meeting started:", meetingId)

    // Call backend to create meeting record
    try {
      await fetch("http://localhost:3001/api/meetings/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // TODO: Add JWT auth
        },
        body: JSON.stringify({
          meetingId,
          startedAt: Date.now(),
        }),
      })
    } catch (error) {
      console.error("[MeetingPage] Failed to start meeting:", error)
    }
  }

  const handleEndMeeting = async () => {
    if (!startedAt) {
      console.error('[MeetingPage] Cannot end meeting: startedAt is null')
      return
    }

    const duration = Math.floor((Date.now() - startedAt) / 1000 / 60) // minutes

    // Confirm before ending
    const confirmed = confirm(`End this meeting?\n\nDuration: ${duration} minute${duration !== 1 ? 's' : ''}\nSegments recorded: ${transcript.length}`)

    if (!confirmed) {
      console.log('[MeetingPage] User cancelled meeting end')
      return
    }

    console.log('[MeetingPage] Ending meeting...')

    // Stop transcription
    stopListening()

    // Set inactive
    setIsActive(false)

    // Call backend to end meeting
    try {
      const response = await fetch("http://localhost:3001/api/meetings/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // TODO: Add JWT auth
        },
        body: JSON.stringify({
          meetingId,
          endedAt: Date.now(),
          durationMinutes: duration,
        }),
      })

      if (response.ok) {
        console.log('[MeetingPage] Meeting ended successfully')
      } else {
        console.error('[MeetingPage] Backend error:', await response.text())
      }

      // Refresh subscription to update usage stats
      await refresh()
    } catch (error) {
      console.error("[MeetingPage] Failed to end meeting:", error)
    }

    // Call callback
    if (onEndMeeting) {
      onEndMeeting()
    }

    // Reset for next meeting
    setStartedAt(null)
    setTranscript([])
    setFullTranscriptText("")
  }

  const handleTimeLimit = () => {
    alert(`Meeting time limit reached (${planConfig.features.maxMinutesPerMeeting} minutes). Upgrade for longer meetings!`)
    handleEndMeeting()
  }

  const handleWarning = (minutesRemaining: number) => {
    // TODO: Show toast notification
    console.log(`[MeetingPage] Warning: ${minutesRemaining} minutes remaining`)
  }

  // ============================================================================
  // DEMO MODE FALLBACK (only if speech recognition not supported)
  // ============================================================================

  useEffect(() => {
    if (!isActive || isSupported) return

    // Demo mode: simulate incoming transcript segments
    const demoTranscripts = [
      "Welcome everyone to today's meeting. Let's get started with the agenda.",
      "I'd like to discuss our Q4 roadmap and key milestones.",
      "That's a great point. We should definitely consider the timeline constraints.",
      "What are your thoughts on the budget allocation for this project?",
      "I agree. Let's make sure we have all stakeholders aligned before proceeding.",
      "Can we schedule a follow-up to review the detailed implementation plan?",
      "Yes, I'll send out a calendar invite for next Tuesday.",
      "Perfect. Let's make sure everyone has access to the shared documents.",
      "Any other questions or concerns before we wrap up?",
      "Great discussion today. Thanks everyone for your input!",
    ]

    let transcriptIndex = 0
    const interval = setInterval(() => {
      if (transcriptIndex >= demoTranscripts.length) {
        transcriptIndex = 0 // Loop back for demo
      }

      const newSegment: TranscriptSegment = {
        id: `segment_${Date.now()}`,
        speaker: transcriptIndex % 3 === 0 ? "You" : transcriptIndex % 3 === 1 ? "Sarah" : "Mike",
        text: demoTranscripts[transcriptIndex],
        timestamp: Date.now(),
      }

      transcriptIndex++
      setTranscript((prev) => [...prev, newSegment])
      setFullTranscriptText((prev) => prev + " " + newSegment.text)
    }, 8000) // New segment every 8 seconds

    return () => clearInterval(interval)
  }, [isActive, isSupported])

  // ============================================================================
  // RENDER: PRE-MEETING STATE
  // ============================================================================

  if (!isActive && !startedAt) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold text-white mb-2"
            >
              Ready for your meeting?
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-gray-400"
            >
              Horalix Halo will transcribe, assist, and recap your conversation in real-time.
            </motion.p>
          </div>

          {/* Usage Indicator */}
          <div className="mb-8">
            <UsageIndicator variant="detailed" />
          </div>

          {/* Start Button */}
          <div className="text-center">
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              onClick={handleStartMeeting}
              disabled={!canStart.allowed}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-2xl shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Meeting
              </div>
            </motion.button>

            {!canStart.allowed && (
              <div className="mt-4 text-red-400 text-sm">{canStart.reason}</div>
            )}
          </div>

          {/* Pre-meeting checklist */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12 p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-purple-500/10"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Before you start:</h3>
            <div className="space-y-3">
              {[
                "Microphone is working",
                "You're in a quiet environment",
                "Meeting participants are ready",
                "You have enough time remaining",
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-purple-500 rounded" />
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: ACTIVE MEETING STATE
  // ============================================================================

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Meeting in Progress</h1>
            <p className="text-sm text-gray-400">Horalix Halo is listening and ready to help</p>
          </div>
          <button
            onClick={handleEndMeeting}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all"
          >
            End Meeting
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Transcript */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transcript Panel */}
            <div className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-purple-500/10">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Live Transcript
                </div>
                <div className="text-xs text-gray-400 font-normal">
                  {isListening ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      Real-time transcription active
                    </span>
                  ) : isSupported ? (
                    <span className="text-yellow-400">Transcription paused</span>
                  ) : (
                    <span className="text-gray-500">Demo mode</span>
                  )}
                </div>
              </h2>
              {transcriptionError && (
                <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                  {transcriptionError}
                </div>
              )}
              <div className="h-96 overflow-y-auto space-y-3">
                {transcript.length === 0 ? (
                  <div className="text-center text-gray-500 py-20">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <p>Waiting for audio...</p>
                  </div>
                ) : (
                  transcript.map((segment) => (
                    <div key={segment.id} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-16 text-xs text-gray-500">
                        {new Date(segment.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-purple-400 mb-1">
                          {segment.speaker}
                        </div>
                        <div className="text-gray-300">{segment.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Meeting Controls */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-purple-500/10">
              <MeetingControls
                meetingId={meetingId}
                transcript={fullTranscriptText}
                onSuggestion={(suggestion) => console.log("Suggestion:", suggestion)}
                onRecap={(recap) => console.log("Recap:", recap)}
              />
            </div>
          </div>

          {/* Right Column: Timer & Stats */}
          <div className="space-y-6">
            {/* Timer */}
            {startedAt && (
              <MeetingTimer
                meetingId={meetingId}
                startedAt={startedAt}
                onTimeLimit={handleTimeLimit}
                onWarning={handleWarning}
              />
            )}

            {/* Quick Actions */}
            <div className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-purple-500/10">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left text-sm text-gray-300 transition-all">
                  📝 Take Note
                </button>
                <button className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left text-sm text-gray-300 transition-all">
                  🔖 Bookmark This Moment
                </button>
                <button className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left text-sm text-gray-300 transition-all">
                  📧 Draft Follow-up Email
                </button>
              </div>
            </div>

            {/* Meeting Info */}
            <div className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-purple-500/10">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                Meeting Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Meeting ID:</span>
                  <span className="text-white font-mono text-xs">{meetingId.slice(0, 16)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Segments:</span>
                  <span className="text-white">{transcript.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Plan:</span>
                  <span className="text-purple-400">{planConfig.marketing.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
