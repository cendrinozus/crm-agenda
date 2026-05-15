import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CheckCircle, XCircle, UserPlus, ChevronDown, Filter,
  Loader2, AlertTriangle, Info, Sparkles, RefreshCw
} from 'lucide-react'
import { calendarApi, clientsApi } from '../services/api'

// ── Confidence badge ───────────────────────────────────────────────────────────
function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  if (score >= 0.8) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                     bg-green-100 text-green-700 font-medium">
      <Sparkles size={10} /> {pct}%
    </span>
  )
  if (score >= 0.5) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                     bg-amber-100 text-amber-700 font-medium">
      <AlertTriangle size={10} /> {pct}%
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                     bg-red-100 text-red-700 font-medium">
      <Info size={10} /> {pct}%
    </span>
  )
}

function MethodLabel({ method }: { method: string }) {
  const labels: Record<string, string> = {
    attendee_name:  'Participant',
    attendee_email: 'Email participant',
    session_with:   '"Session with"',
    with_pattern:   '"With" pattern',
    avec_pattern:   '"Avec" pattern',
    keyword_prefix: 'Mot-clé titre',
    separator:      'Séparateur',
    bare_title:     'Titre brut',
    none:           'Non détecté',
  }
  return <span className="text-xs text-surface-400">{labels[method] || method}</span>
}

// ── Assign modal (inline) ──────────────────────────────────────────────────────
function AssignDropdown({
  meetingId, clients, onAssign, onClose
}: {
  meetingId: number
  clients: any[]
  onAssign: (clientId?: number, newName?: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border border-surface-200
                    rounded-xl shadow-dialog overflow-hidden">
      <div className="p-2 border-b border-surface-100">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nom du client…"
          className="w-full px-2.5 py-1.5 text-sm bg-surface-50 border border-surface-200
                     rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => { onAssign(c.id); onClose() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                       hover:bg-surface-50 transition-colors"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center
                            text-xs font-semibold shrink-0"
                 style={{ background: c.color + '22', color: c.color }}>
              {c.name.slice(0, 2).toUpperCase()}
            </div>
            {c.name}
          </button>
        ))}
        {search && !filtered.find(c => c.name.toLowerCase() === search.toLowerCase()) && (
          <button
            onClick={() => { onAssign(undefined, search); onClose() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                       text-brand-600 hover:bg-brand-50 border-t border-surface-100"
          >
            <UserPlus size={13} />
            Créer « {search} »
          </button>
        )}
      </div>
      <div className="border-t border-surface-100">
        <button onClick={onClose}
          className="w-full px-3 py-2 text-xs text-surface-400 hover:bg-surface-50">
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── Single review row ──────────────────────────────────────────────────────────
function ReviewRow({
  meeting, clients, onAction, selected, onSelect
}: {
  meeting: any
  clients: any[]
  onAction: (id: number, action: string, payload?: any) => void
  selected: boolean
  onSelect: (id: number) => void
}) {
  const [showAssign, setShowAssign] = useState(false)
  const review = meeting.review
  const dt = meeting.start_time ? parseISO(meeting.start_time) : null
  const assignedClient = clients.find(c => c.id === meeting.client_id)

  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 border-b border-surface-100
                     hover:bg-surface-50 transition-colors group
                     ${selected ? 'bg-brand-50' : ''}`}>
      {/* Checkbox */}
      <input type="checkbox" checked={selected} onChange={() => onSelect(meeting.id)}
        className="mt-0.5 rounded" />

      {/* Event info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-surface-800 truncate">{meeting.title}</p>
          {review && <ConfidenceBadge score={review.confidence} />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {dt && (
            <span className="text-xs text-surface-500">
              {format(dt, "d MMM yyyy · HH:mm", { locale: fr })}
            </span>
          )}
          {review?.detection_method && <MethodLabel method={review.detection_method} />}
        </div>

        {/* Suggested client */}
        {review?.suggested_client && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs text-surface-400">Suggestion :</span>
            <span className="text-xs font-medium text-surface-700 bg-surface-100
                             px-2 py-0.5 rounded-full">
              {review.suggested_client}
            </span>
            {assignedClient && assignedClient.name !== review.suggested_client && (
              <>
                <span className="text-xs text-surface-400">→ assigné à</span>
                <span className="text-xs font-medium text-brand-700 bg-brand-50
                                 px-2 py-0.5 rounded-full">
                  {assignedClient.name}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 relative">
        {/* Confirm */}
        <button
          onClick={() => onAction(meeting.id, 'confirm')}
          title="Confirmer le client détecté"
          className="p-1.5 rounded-lg text-surface-400 hover:text-green-600
                     hover:bg-green-50 transition-all"
        >
          <CheckCircle size={16} />
        </button>

        {/* Assign to different client */}
        <button
          onClick={() => setShowAssign(v => !v)}
          title="Assigner à un autre client"
          className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600
                     hover:bg-brand-50 transition-all"
        >
          <UserPlus size={16} />
        </button>

        {/* Exclude */}
        <button
          onClick={() => onAction(meeting.id, 'exclude')}
          title="Exclure (événement interne)"
          className="p-1.5 rounded-lg text-surface-400 hover:text-red-500
                     hover:bg-red-50 transition-all"
        >
          <XCircle size={16} />
        </button>

        {showAssign && (
          <AssignDropdown
            meetingId={meeting.id}
            clients={clients}
            onAssign={(clientId, newName) =>
              onAction(meeting.id, 'assign', { client_id: clientId, new_client_name: newName })
            }
            onClose={() => setShowAssign(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function ReviewQueuePage() {
  const qc = useQueryClient()
  const [filter, setFilter]       = useState<'all' | 'low' | 'medium'>('all')
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState('')

  const { data: meetings = [], isLoading, refetch } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => calendarApi.reviewQueue().then(r => r.data),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list().then(r => r.data),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, action, payload }: any) =>
      calendarApi.resolveReview(id, { action, ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: any) =>
      calendarApi.bulkResolve(ids, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      setSelected(new Set())
    },
  })

  const filtered = useMemo(() => {
    return meetings.filter((m: any) => {
      if (filter === 'low')    return (m.review?.confidence ?? 0) < 0.5
      if (filter === 'medium') return (m.review?.confidence ?? 0) >= 0.5 && (m.review?.confidence ?? 0) < 0.8
      return true
    })
  }, [meetings, filter])

  const allSelected = filtered.length > 0 && filtered.every((m: any) => selected.has(m.id))
  const toggleAll   = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map((m: any) => m.id)))
  }
  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const counts = useMemo(() => ({
    all:    meetings.length,
    low:    meetings.filter((m: any) => (m.review?.confidence ?? 0) < 0.5).length,
    medium: meetings.filter((m: any) => {
      const c = m.review?.confidence ?? 0; return c >= 0.5 && c < 0.8
    }).length,
  }), [meetings])

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-surface-400 text-sm">
      <Loader2 className="animate-spin" size={18} /> Chargement de la file de révision…
    </div>
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-surface-900 mb-1">
            File de validation
          </h1>
          <p className="text-sm text-surface-500">
            {meetings.length} événement{meetings.length > 1 ? 's' : ''} nécessitent votre validation
          </p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-200
                     text-sm text-surface-600 hover:bg-surface-50 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {meetings.length === 0 && (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-card
                        p-12 text-center text-surface-400">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
          <p className="font-medium text-surface-700">Tout est validé !</p>
          <p className="text-sm mt-1">Aucun événement en attente de révision.</p>
        </div>
      )}

      {meetings.length > 0 && (
        <>
          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-4">
            <Filter size={14} className="text-surface-400" />
            {([
              { key: 'all',    label: 'Tous',              count: counts.all },
              { key: 'medium', label: 'Confiance moyenne', count: counts.medium },
              { key: 'low',    label: 'Confiance faible',  count: counts.low },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-sm transition-colors flex items-center gap-1.5
                  ${filter === tab.key
                    ? 'bg-brand-500 text-white'
                    : 'border border-surface-200 text-surface-600 hover:bg-surface-50'}`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full
                  ${filter === tab.key ? 'bg-white/20' : 'bg-surface-100'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-brand-50 border border-brand-200
                            rounded-xl px-4 py-2.5 mb-4">
              <span className="text-sm font-medium text-brand-700">
                {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => bulkMutation.mutate({ ids: [...selected], action: 'confirm' })}
                disabled={bulkMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                           bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              >
                <CheckCircle size={13} /> Confirmer tous
              </button>
              <button
                onClick={() => bulkMutation.mutate({ ids: [...selected], action: 'exclude' })}
                disabled={bulkMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                           bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              >
                <XCircle size={13} /> Exclure tous
              </button>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-50 border-b border-surface-200">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
              <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">
                Événement
              </span>
              <div className="flex-1" />
              <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">
                Actions
              </span>
            </div>

            {/* Rows */}
            {filtered.map((m: any) => (
              <ReviewRow
                key={m.id}
                meeting={m}
                clients={clients}
                selected={selected.has(m.id)}
                onSelect={toggleOne}
                onAction={(id, action, payload) => resolveMutation.mutate({ id, action, payload })}
              />
            ))}

            {filtered.length === 0 && (
              <p className="text-center text-sm text-surface-400 py-8">
                Aucun événement dans ce filtre
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-surface-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={12} className="text-green-500" /> Confirmer la détection automatique
            </span>
            <span className="flex items-center gap-1.5">
              <UserPlus size={12} className="text-brand-500" /> Assigner à un autre client
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle size={12} className="text-red-400" /> Marquer comme événement interne (exclure)
            </span>
          </div>
        </>
      )}
    </div>
  )
}
