import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ToggleLeft, ToggleRight, Shield, Info } from 'lucide-react'
import { calendarApi } from '../../services/api'

// Built-in defaults (display only, non-editable)
const BUILTIN_EXAMPLES = [
  { pattern: '^CC$',              label: 'Bloc CC (réunion interne récurrente)' },
  { pattern: '^Office H.*',       label: 'Office Hours' },
  { pattern: '\\[.*Off\\]',       label: 'Blocs Off / Pause' },
  { pattern: '.*hour buffer.*',   label: 'Buffer de temps' },
  { pattern: '^(lunch|déjeuner)', label: 'Repas' },
  { pattern: '^Mother.*Day',      label: 'Fêtes / jours fériés' },
]

export function ExclusionRulesPanel() {
  const qc = useQueryClient()
  const [pattern, setPattern] = useState('')
  const [label,   setLabel]   = useState('')
  const [error,   setError]   = useState('')

  const { data: rules = [] } = useQuery({
    queryKey: ['exclusions'],
    queryFn: () => calendarApi.listExclusions().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => calendarApi.createExclusion(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exclusions'] })
      setPattern('')
      setLabel('')
      setError('')
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Erreur'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => calendarApi.deleteExclusion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exclusions'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => calendarApi.toggleExclusion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exclusions'] }),
  })

  const handleAdd = () => {
    if (!pattern.trim()) { setError('Le pattern est requis'); return }
    createMutation.mutate({ pattern: pattern.trim(), label: label.trim() || pattern.trim() })
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          Les règles d'exclusion utilisent des <strong>expressions régulières</strong>.
          Les événements correspondants seront ignorés lors de la synchronisation.
          Des règles par défaut couvrent déjà les patterns courants (CC, buffer, repas…).
        </div>
      </div>

      {/* Built-in rules */}
      <div>
        <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
          <Shield size={12} className="inline mr-1" />
          Règles intégrées (non modifiables)
        </p>
        <div className="bg-surface-50 rounded-xl border border-surface-200 divide-y divide-surface-100">
          {BUILTIN_EXAMPLES.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <code className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-mono">
                {r.pattern}
              </code>
              <span className="text-xs text-surface-500 flex-1">{r.label}</span>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Actif</span>
            </div>
          ))}
        </div>
      </div>

      {/* User rules */}
      <div>
        <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
          Vos règles personnalisées
        </p>

        {rules.length === 0 && (
          <p className="text-sm text-surface-400 py-4 text-center border border-dashed border-surface-200 rounded-xl">
            Aucune règle personnalisée · Ajoutez-en ci-dessous
          </p>
        )}

        {rules.length > 0 && (
          <div className="bg-white rounded-xl border border-surface-200 divide-y divide-surface-100 mb-3">
            {rules.map((r: any) => (
              <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 ${!r.active ? 'opacity-50' : ''}`}>
                <code className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-mono">
                  {r.pattern}
                </code>
                <span className="text-xs text-surface-600 flex-1">{r.label}</span>
                <button onClick={() => toggleMutation.mutate(r.id)}
                  className="text-surface-400 hover:text-brand-500 transition-colors">
                  {r.active
                    ? <ToggleRight size={18} className="text-green-500" />
                    : <ToggleLeft size={18} />}
                </button>
                <button onClick={() => deleteMutation.mutate(r.id)}
                  className="text-surface-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              value={pattern}
              onChange={e => { setPattern(e.target.value); setError('') }}
              placeholder="Pattern regex, ex: ^TT Live$"
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl
                         bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400
                         font-mono"
            />
          </div>
          <div className="flex-1">
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Description (optionnel)"
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl
                         bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={createMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-900 text-white
                       rounded-xl text-sm hover:bg-surface-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    </div>
  )
}
