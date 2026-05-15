import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Save, Loader2, ChevronDown, ChevronUp, ListTodo } from 'lucide-react'
import { notesApi, aiApi } from '../../services/api'
import { VoiceRecorder } from './VoiceRecorder'

interface Note {
  id?: number
  note_text?: string
  next_actions?: string
  transcript?: string
  ai_summary?: string
  ai_next_agenda?: string
}

interface Props {
  meetingId: number
  note?: Note
  onSaved?: () => void
}

export function MeetingNoteEditor({ meetingId, note, onSaved }: Props) {
  const qc = useQueryClient()
  const [noteText, setNoteText]       = useState(note?.note_text || '')
  const [nextActions, setNextActions] = useState(note?.next_actions || '')
  const [aiSection, setAiSection]     = useState<'summary' | 'agenda' | 'tasks' | null>(null)
  const [aiContent, setAiContent]     = useState<string | null>(note?.ai_summary || null)
  const [tasks, setTasks]             = useState<any[]>([])

  const saveMutation = useMutation({
    mutationFn: () =>
      note?.id
        ? notesApi.update(note.id, { note_text: noteText, next_actions: nextActions })
        : notesApi.create(meetingId, { note_text: noteText, next_actions: nextActions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
      onSaved?.()
    },
  })

  const aiSummaryMutation = useMutation({
    mutationFn: () => aiApi.summarize(meetingId),
    onSuccess: ({ data }) => {
      setAiContent(data.summary)
      setAiSection('summary')
    },
  })

  const aiAgendaMutation = useMutation({
    mutationFn: () => aiApi.nextAgenda(meetingId),
    onSuccess: ({ data }) => {
      setAiContent(data.agenda)
      setAiSection('agenda')
    },
  })

  const aiTasksMutation = useMutation({
    mutationFn: () => aiApi.detectTasks(meetingId),
    onSuccess: ({ data }) => {
      setTasks(data.tasks)
      setAiSection('tasks')
    },
  })

  const handleTranscript = (text: string) => {
    setNoteText(prev => prev ? prev + '\n\n' + text : text)
  }

  const anyAiLoading = aiSummaryMutation.isPending || aiAgendaMutation.isPending || aiTasksMutation.isPending

  return (
    <div className="space-y-4">
      {/* Notes section */}
      <div>
        <label className="text-xs font-medium text-surface-500 uppercase tracking-wider block mb-1.5">
          Compte rendu & notes
        </label>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Ce qui a été discuté, décisions prises, points importants…"
          rows={4}
          className="w-full px-3 py-2.5 text-sm bg-surface-50 border border-surface-200
                     rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400
                     focus:bg-white placeholder-surface-400 resize-y transition"
        />
      </div>

      {/* Next actions */}
      <div>
        <label className="text-xs font-medium text-surface-500 uppercase tracking-wider block mb-1.5">
          Prochaines actions
        </label>
        <textarea
          value={nextActions}
          onChange={e => setNextActions(e.target.value)}
          placeholder="- Envoyer le document avant vendredi&#10;- Planifier la prochaine réunion&#10;- Préparer la matrice des risques"
          rows={3}
          className="w-full px-3 py-2.5 text-sm bg-surface-50 border border-surface-200
                     rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400
                     focus:bg-white placeholder-surface-400 resize-y font-mono transition"
        />
      </div>

      {/* Transcript display */}
      {note?.transcript && (
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-3">
          <p className="text-xs font-medium text-surface-400 mb-1">Transcription vocale</p>
          <p className="text-sm text-surface-700">{note.transcript}</p>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <VoiceRecorder meetingId={meetingId} onTranscript={handleTranscript} />

        <div className="flex-1" />

        {/* AI buttons */}
        <button
          onClick={() => aiSummaryMutation.mutate()}
          disabled={anyAiLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                     border border-purple-200 text-purple-700 bg-purple-50
                     hover:bg-purple-100 disabled:opacity-50 transition-all"
        >
          {aiSummaryMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Résumé IA
        </button>

        <button
          onClick={() => aiAgendaMutation.mutate()}
          disabled={anyAiLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                     border border-blue-200 text-blue-700 bg-blue-50
                     hover:bg-blue-100 disabled:opacity-50 transition-all"
        >
          {aiAgendaMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
          Ordre du jour
        </button>

        <button
          onClick={() => aiTasksMutation.mutate()}
          disabled={anyAiLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                     border border-amber-200 text-amber-700 bg-amber-50
                     hover:bg-amber-100 disabled:opacity-50 transition-all"
        >
          {aiTasksMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <ListTodo size={13} />}
          Tâches
        </button>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm
                     bg-brand-500 text-white hover:bg-brand-600
                     disabled:opacity-50 transition-all"
        >
          {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Enregistrer
        </button>
      </div>

      {/* AI output */}
      {aiSection && aiContent && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200
                        rounded-xl p-4">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">
            {aiSection === 'summary' ? '✨ Résumé IA' : '📋 Ordre du jour suggéré'}
          </p>
          <p className="text-sm text-surface-800 whitespace-pre-wrap leading-relaxed">{aiContent}</p>
        </div>
      )}

      {aiSection === 'tasks' && tasks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">
            ✅ Tâches détectées
          </p>
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span className="text-surface-800">{t.task}</span>
                {t.due && <span className="text-xs text-amber-600 ml-auto shrink-0">{t.due}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
