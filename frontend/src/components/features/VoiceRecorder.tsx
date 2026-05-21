import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, Square } from 'lucide-react'

interface Props {
  onStart: () => void
  onTextUpdate: (text: string) => void
}

export function VoiceRecorder({ onStart, onTextUpdate }: Props) {
  const { t } = useTranslation()
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const finalRef = useRef('')

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError(t('meeting.micDenied'))
      return
    }
    setError(null)
    finalRef.current = ''
    onStart()

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalRef.current += text
        } else {
          interim = text
        }
      }
      onTextUpdate(finalRef.current + interim)
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') setError(t('meeting.micDenied'))
      setListening(false)
    }

    rec.onend = () => setListening(false)

    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }, [onStart, onTextUpdate, t])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return (
    <div className="flex items-center gap-1.5">
      {!listening ? (
        <button
          type="button"
          onClick={start}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs
                     border border-surface-200 text-surface-400
                     hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <Mic size={12} /> {t('meeting.dictate')}
        </button>
      ) : (
        <button
          type="button"
          onClick={stop}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs
                     border border-red-300 bg-red-50 text-red-600
                     hover:bg-red-100 transition-all animate-pulse"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          {t('meeting.stop')} <Square size={11} />
        </button>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
