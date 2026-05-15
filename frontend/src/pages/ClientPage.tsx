import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, isPast, isToday, differenceInMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, Edit2, Phone, Mail, Building2, ChevronDown, ChevronUp,
  MapPin, Clock, Users, Check, X
} from 'lucide-react'
import { clientsApi } from '../services/api'
import { MeetingNoteEditor } from '../components/features/MeetingNoteEditor'
import { ClientWorkflow } from '../components/features/ClientWorkflow'

function StatusBadge({ start }: { start: string }) {
  const dt = parseISO(start)
  if (isToday(dt)) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Aujourd'hui</span>
  if (isPast(dt))  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-100 text-surface-500">Passé</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">À venir</span>
}

export function ClientPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [expandedMeeting, setExpandedMeeting] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<any>({})

  const { data: client, isLoading } = useQuery<any>({
    queryKey: ['client', id],
    queryFn: () => clientsApi.get(Number(id)).then(r => r.data),
  })

  useEffect(() => {
    if (client) {
      setEditData({ name: client.name, company: client.company, email: client.email, phone: client.phone, notes: client.notes })
    }
  }, [client])

  const updateMutation = useMutation({
    mutationFn: (data: any) => clientsApi.update(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setEditMode(false)
    },
  })

  const workflowMutation = useMutation({
    mutationFn: (stage: string | null) => clientsApi.setWorkflowStage(Number(id), stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  if (isLoading) return (
    <div className="p-8 text-surface-400 text-sm">Chargement…</div>
  )
  if (!client) return null

  const meetings = client.meetings || []
  const pastMeetings     = meetings.filter((m: any) => m.start_time && isPast(parseISO(m.start_time)) && !isToday(parseISO(m.start_time)))
  const upcomingMeetings = meetings.filter((m: any) => !m.start_time || !isPast(parseISO(m.start_time)) || isToday(parseISO(m.start_time)))

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Retour
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-semibold shrink-0"
            style={{ background: client.color + '22', color: client.color }}
          >
            {client.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {['name','company','email','phone'].map(f => (
                    <div key={f}>
                      <label className="text-xs text-surface-400 capitalize">{f}</label>
                      <input
                        value={editData[f] || ''}
                        onChange={e => setEditData((d: any) => ({ ...d, [f]: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-surface-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateMutation.mutate(editData)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white
                               rounded-lg text-sm hover:bg-brand-400 transition-colors">
                    <Check size={13} /> Enregistrer
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-surface-200
                               rounded-lg text-sm text-surface-600 hover:bg-surface-50 transition-colors">
                    <X size={13} /> Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-display text-2xl text-surface-900">{client.name}</h1>
                  <button onClick={() => setEditMode(true)}
                    className="text-surface-400 hover:text-surface-700 transition-colors">
                    <Edit2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-surface-500">
                  {client.company && <span className="flex items-center gap-1"><Building2 size={13} />{client.company}</span>}
                  {client.email   && <span className="flex items-center gap-1"><Mail size={13} />{client.email}</span>}
                  {client.phone   && <span className="flex items-center gap-1"><Phone size={13} />{client.phone}</span>}
                </div>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-center shrink-0">
            <div>
              <p className="text-xl font-semibold text-surface-900">{meetings.length}</p>
              <p className="text-xs text-surface-400">RDV total</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-green-600">{upcomingMeetings.length}</p>
              <p className="text-xs text-surface-400">À venir</p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow de progression */}
      <ClientWorkflow
        clientId={Number(id)}
        workflowStage={client.workflow_stage ?? null}
        onStageChange={(stage) => workflowMutation.mutate(stage)}
      />

      {/* Meetings timeline — Compte rendu & notes */}
      {[
        { label: 'À venir', items: upcomingMeetings, accent: 'border-l-accent-500' },
        { label: 'Passés',  items: pastMeetings,     accent: 'border-l-surface-200' },
      ].map(({ label, items, accent }) => items.length > 0 && (
        <div key={label} className="mb-8">
          <h2 className="text-sm font-semibold text-surface-600 uppercase tracking-wider mb-3">
            {label} · {items.length}
          </h2>
          <div className="space-y-3">
            {items.map((meeting: any) => {
              const isExpanded = expandedMeeting === meeting.id
              const dt = meeting.start_time ? parseISO(meeting.start_time) : null
              const duration = (meeting.start_time && meeting.end_time)
                ? differenceInMinutes(parseISO(meeting.end_time), parseISO(meeting.start_time))
                : null
              const latestNote = meeting.notes?.[0]

              return (
                <div key={meeting.id}
                  className={`bg-white rounded-2xl border border-surface-200 shadow-card
                              border-l-4 ${accent} overflow-hidden`}>
                  {/* Meeting header */}
                  <button
                    onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                    className="w-full flex items-start gap-4 p-4 text-left hover:bg-surface-50 transition-colors"
                  >
                    {dt && (
                      <div className="text-center shrink-0 w-12">
                        <p className="text-lg font-semibold text-surface-900 leading-none">{format(dt, 'd')}</p>
                        <p className="text-xs text-surface-500">{format(dt, 'MMM', { locale: fr })}</p>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-surface-800 truncate">{meeting.title}</p>
                        {dt && <StatusBadge start={meeting.start_time} />}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-surface-500">
                        {dt && <span className="flex items-center gap-1"><Clock size={11} />{format(dt, 'HH:mm')}</span>}
                        {duration && <span className="flex items-center gap-1"><Clock size={11} />{duration} min</span>}
                        {meeting.location && <span className="flex items-center gap-1 truncate"><MapPin size={11} />{meeting.location}</span>}
                        {meeting.attendees?.filter((a: any) => !a.self).length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users size={11} />{meeting.attendees.filter((a: any) => !a.self).map((a: any) => a.name || a.email).join(', ')}
                          </span>
                        )}
                      </div>
                      {!isExpanded && latestNote?.note_text && (
                        <p className="text-xs text-surface-400 mt-1.5 truncate">{latestNote.note_text}</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-surface-400 shrink-0 mt-0.5" />
                                : <ChevronDown size={16} className="text-surface-400 shrink-0 mt-0.5" />}
                  </button>

                  {/* Expanded — Compte rendu & notes */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-surface-100">
                      <div className="pt-4">
                        <MeetingNoteEditor
                          meetingId={meeting.id}
                          note={latestNote}
                          onSaved={() => qc.invalidateQueries({ queryKey: ['client', id] })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {meetings.length === 0 && (
        <div className="text-center py-16 text-surface-400 text-sm">
          Aucun rendez-vous pour ce client · Synchronisez votre agenda
        </div>
      )}
    </div>
  )
}
