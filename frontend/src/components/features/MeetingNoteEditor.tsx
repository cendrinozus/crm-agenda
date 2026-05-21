import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Save, Loader2 } from 'lucide-react'
import { notesApi } from '../../services/api'
import { VoiceRecorder } from './VoiceRecorder'

interface Note {
  id?: number
  note_text?: string
  next_actions?: string
}

interface Props {
  meetingId: number
  note?: Note
  onSaved?: () => void
}

export function MeetingNoteEditor({ meetingId, note, onSaved }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [noteText, setNoteText]       = useState(note?.note_text || '')
  const [nextActions, setNextActions] = useState(note?.next_actions || '')

  const noteBase    = useRef('')
  const actionsBase = useRef('')

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

  return (
    <div className="space-y-4">
      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-surface-500 uppercase tracking-wider">
            {t('meeting.notes')}
          </label>
          <VoiceRecorder
            onStart={() => { noteBase.current = noteText }}
            onTextUpdate={text => setNoteText(noteBase.current + (noteBase.current && text ? '\n\n' : '') + text)}
          />
        </div>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder={t('meeting.notesPH')}
          rows={4}
          className="w-full px-3 py-2.5 text-sm bg-surface-50 border border-surface-200
                     rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400
                     focus:bg-white placeholder-surface-400 resize-y transition"
        />
      </div>

      {/* Next actions */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-surface-500 uppercase tracking-wider">
            {t('meeting.nextActions')}
          </label>
          <VoiceRecorder
            onStart={() => { actionsBase.current = nextActions }}
            onTextUpdate={text => setNextActions(actionsBase.current + (actionsBase.current && text ? '\n' : '') + text)}
          />
        </div>
        <textarea
          value={nextActions}
          onChange={e => setNextActions(e.target.value)}
          placeholder={t('meeting.nextActionsPH')}
          rows={3}
          className="w-full px-3 py-2.5 text-sm bg-surface-50 border border-surface-200
                     rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400
                     focus:bg-white placeholder-surface-400 resize-y font-mono transition"
        />
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm
                     bg-brand-500 text-white hover:bg-brand-600
                     disabled:opacity-50 transition-all"
        >
          {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}
