import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, Square, Loader2, CheckCircle } from 'lucide-react'
import { voiceApi } from '../../services/api'

interface Props {
  meetingId?: number
  onTranscript: (text: string, noteId?: number) => void
}

type RecordState = 'idle' | 'recording' | 'processing' | 'done'

export function VoiceRecorder({ meetingId, onTranscript }: Props) {
  const { t } = useTranslation()
  const [state, setState] = useState<RecordState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunks.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setState('processing')
        clearInterval(timer.current!)
        try {
          const blob = new Blob(chunks.current, { type: 'audio/webm' })
          const file = new File([blob], 'recording.webm', { type: 'audio/webm' })
          const { data } = await voiceApi.transcribe(file, meetingId)
          onTranscript(data.transcript, data.note_id)
          setState('done')
          setTimeout(() => { setState('idle'); setSeconds(0) }, 2000)
        } catch {
          setError(t('meeting.transcriptFailed'))
          setState('idle')
        }
      }
      mr.start()
      mediaRecorder.current = mr
      setState('recording')
      setSeconds(0)
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      setError(t('meeting.micDenied'))
    }
  }, [meetingId, onTranscript, t])

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop()
  }, [])

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="flex items-center gap-3">
      {state === 'idle' && (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-200
                     text-sm text-surface-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600
                     transition-all"
        >
          <Mic size={14} /> {t('meeting.dictate')}
        </button>
      )}

      {state === 'recording' && (
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-300
                     bg-red-50 text-sm text-red-600 hover:bg-red-100 transition-all animate-pulse"
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {fmt(seconds)} — {t('meeting.stop')}
          <Square size={12} />
        </button>
      )}

      {state === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-surface-500">
          <Loader2 size={14} className="animate-spin" /> {t('meeting.transcribing')}
        </div>
      )}

      {state === 'done' && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle size={14} /> {t('meeting.transcribed')}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
