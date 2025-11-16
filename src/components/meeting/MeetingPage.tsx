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
import { ConfirmDialog } from "../ui/ConfirmDialog"
import { translationService } from "../../services/translation"

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

  // Dialog states
  const [showBrowserWarning, setShowBrowserWarning] = useState(false)
  const [showEndMeetingConfirm, setShowEndMeetingConfirm] = useState(false)
  const [meetingDuration, setMeetingDuration] = useState(0)

  // Quick Actions states
  const [notes, setNotes] = useState<Array<{ timestamp: number; text: string; id: string }>>([])
  const [bookmarks, setBookmarks] = useState<Array<{ timestamp: number; id: string }>>([])
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showEmailDraft, setShowEmailDraft] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [emailDraft, setEmailDraft] = useState("")

  // Translation states
  const [translationEnabled, setTranslationEnabled] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState("es") // Default to Spanish
  const [translatedTranscript, setTranslatedTranscript] = useState<TranscriptSegment[]>([])
  const [availableLanguages] = useState([
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
  ])

  // Real-time speech recognition with translation
  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    enableDiarization: true,
    onSegment: async (segment) => {
      setTranscript((prev) => [...prev, segment])
      setFullTranscriptText((prev) => prev + "\n" + `${segment.speaker}: ${segment.text}`)

      // Translate if enabled
      if (translationEnabled) {
        try {
          const result = await translationService.translate(segment.text, targetLanguage, 'auto')
          const translatedSegment = {
            ...segment,
            text: result.translatedText,
          }
          setTranslatedTranscript((prev) => [...prev, translatedSegment])
        } catch (error) {
          console.error('[MeetingPage] Translation error:', error)
        }
      }
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
      // Will be replaced with a proper dialog later if needed
      console.error("[MeetingPage] Cannot start meeting:", canStart.reason)
      return
    }

    // Check if speech recognition is supported
    if (!isSupported) {
      setShowBrowserWarning(true)
      return
    }

    startMeeting()
  }

  const startMeeting = async () => {
    // Request microphone permission explicitly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log("[MeetingPage] Microphone access granted")
      // Stop the test stream, we'll use Speech API instead
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error("[MeetingPage] Microphone access denied:", error)
      setTranscriptionError("Microphone access denied. Please allow microphone access to use transcription.")
      return
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

  const handleEndMeeting = () => {
    if (!startedAt) {
      console.error('[MeetingPage] Cannot end meeting: startedAt is null')
      return
    }

    const duration = Math.floor((Date.now() - startedAt) / 1000 / 60) // minutes
    setMeetingDuration(duration)
    setShowEndMeetingConfirm(true)
  }

  const confirmEndMeeting = async () => {
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
          durationMinutes: meetingDuration,
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
    setShowEndMeetingConfirm(false)
  }

  const handleTimeLimit = () => {
    // Time limit reached - force end meeting
    console.log('[MeetingPage] Time limit reached, ending meeting')
    if (startedAt) {
      const duration = Math.floor((Date.now() - startedAt) / 1000 / 60)
      setMeetingDuration(duration)
      confirmEndMeeting()
    }
  }

  const handleWarning = (minutesRemaining: number) => {
    // TODO: Show toast notification
    console.log(`[MeetingPage] Warning: ${minutesRemaining} minutes remaining`)
  }

  // ============================================================================
  // QUICK ACTIONS
  // ============================================================================

  const handleTakeNote = () => {
    setShowNoteDialog(true)
  }

  const saveNote = () => {
    if (!noteText.trim()) return

    const newNote = {
      id: `note_${Date.now()}`,
      timestamp: Date.now(),
      text: noteText.trim(),
    }

    setNotes((prev) => [...prev, newNote])
    setNoteText("")
    setShowNoteDialog(false)
    console.log("[MeetingPage] Note saved:", newNote)
  }

  const handleBookmark = () => {
    const newBookmark = {
      id: `bookmark_${Date.now()}`,
      timestamp: Date.now(),
    }

    setBookmarks((prev) => [...prev, newBookmark])
    console.log("[MeetingPage] Bookmark created:", newBookmark)

    // Show brief confirmation (could be a toast in the future)
    const currentSegment = transcript[transcript.length - 1]
    console.log("[MeetingPage] Bookmarked at:", currentSegment?.text || "current moment")
  }

  const handleDraftEmail = async () => {
    console.log("[MeetingPage] Generating follow-up email draft...")

    // Generate email using AI
    try {
      const response = await window.electronAPI.invoke('llm:generate', {
        modelId: 'meeting-email-drafter',
        messages: [
          {
            role: 'user',
            content: `Based on this meeting transcript, draft a professional follow-up email:\n\n${fullTranscriptText}\n\nInclude: summary of key points, action items, and next steps.`,
          },
        ],
      })

      if (response.success) {
        setEmailDraft(response.content)
        setShowEmailDraft(true)
      } else {
        console.error("[MeetingPage] Failed to generate email draft")
      }
    } catch (error) {
      console.error("[MeetingPage] Error generating email:", error)
    }
  }

  const copyEmailToClipboard = () => {
    navigator.clipboard.writeText(emailDraft)
    console.log("[MeetingPage] Email draft copied to clipboard")
    // TODO: Show toast confirmation
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
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center justify-between mb-3">
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

                {/* Translation Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => {
                      setTranslationEnabled(!translationEnabled)
                      if (!translationEnabled) {
                        setTranslatedTranscript([])
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      translationEnabled
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    🌐 {translationEnabled ? 'Translation ON' : 'Enable Translation'}
                  </button>

                  {translationEnabled && (
                    <select
                      value={targetLanguage}
                      onChange={(e) => {
                        setTargetLanguage(e.target.value)
                        setTranslatedTranscript([])
                      }}
                      className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      {availableLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code} className="bg-gray-900">
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
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
                  transcript.map((segment, index) => {
                    const translatedSegment = translatedTranscript[index]
                    return (
                      <div key={segment.id} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-16 text-xs text-gray-500">
                          {new Date(segment.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-purple-400 mb-1">
                            {segment.speaker}
                          </div>
                          <div className="text-gray-300">{segment.text}</div>
                          {translationEnabled && translatedSegment && (
                            <div className="mt-2 pl-3 border-l-2 border-blue-500/30 text-sm text-blue-300 italic">
                              {translatedSegment.text}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
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
                <button
                  onClick={handleTakeNote}
                  className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left text-sm text-gray-300 transition-all"
                >
                  📝 Take Note
                </button>
                <button
                  onClick={handleBookmark}
                  className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left text-sm text-gray-300 transition-all"
                >
                  🔖 Bookmark This Moment
                </button>
                <button
                  onClick={handleDraftEmail}
                  className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left text-sm text-gray-300 transition-all"
                >
                  📧 Draft Follow-up Email
                </button>
              </div>

              {/* Notes and Bookmarks Display */}
              {(notes.length > 0 || bookmarks.length > 0) && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  {bookmarks.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-400 mb-2">Bookmarks: {bookmarks.length}</div>
                    </div>
                  )}
                  {notes.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Notes: {notes.length}</div>
                    </div>
                  )}
                </div>
              )}
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

        {/* Confirmation Dialogs */}
        <ConfirmDialog
          isOpen={showBrowserWarning}
          title="Browser Compatibility"
          message="Real-time transcription requires Chrome or Edge browser. Would you like to continue with demo mode?"
          confirmText="Continue with Demo"
          cancelText="Cancel"
          type="warning"
          onConfirm={() => {
            setShowBrowserWarning(false)
            startMeeting()
          }}
          onCancel={() => setShowBrowserWarning(false)}
        />

        <ConfirmDialog
          isOpen={showEndMeetingConfirm}
          title="End Meeting"
          message={`Are you sure you want to end this meeting?\n\nDuration: ${meetingDuration} minute${meetingDuration !== 1 ? 's' : ''}\nSegments recorded: ${transcript.length}`}
          confirmText="End Meeting"
          cancelText="Continue Meeting"
          type="warning"
          onConfirm={confirmEndMeeting}
          onCancel={() => setShowEndMeetingConfirm(false)}
        />

        {/* Take Note Dialog */}
        {showNoteDialog && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowNoteDialog(false)}
            />
            <div className="relative z-10 w-full max-w-md mx-4">
              <div className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-600/20 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-3">Take a Note</h3>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="What would you like to remember?"
                  className="w-full h-32 px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 resize-none"
                  autoFocus
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowNoteDialog(false)}
                    className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNote}
                    disabled={!noteText.trim()}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Draft Dialog */}
        {showEmailDraft && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowEmailDraft(false)}
            />
            <div className="relative z-10 w-full max-w-2xl mx-4">
              <div className="p-6 bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-3">Follow-up Email Draft</h3>
                <div className="bg-black/30 border border-white/20 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm">
                    {emailDraft}
                  </pre>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowEmailDraft(false)}
                    className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={copyEmailToClipboard}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all shadow-lg"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
