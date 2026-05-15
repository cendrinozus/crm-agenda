import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendarApi, clientsApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { RefreshCw, Loader2, GitMerge } from 'lucide-react'
import { ExclusionRulesPanel } from '../components/features/ExclusionRulesPanel'

export function SettingsPage() {
  const { user, logout } = useAuthStore()
  const qc = useQueryClient()
  const [mergeSource, setMergeSource] = useState('')
  const [mergeTarget, setMergeTarget] = useState('')

  const { data: calStatus } = useQuery({
    queryKey: ['cal-status'],
    queryFn: () => calendarApi.status().then(r => r.data),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list().then(r => r.data),
  })

  const syncMutation = useMutation({
    mutationFn: () => calendarApi.sync(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  const mergeMutation = useMutation({
    mutationFn: () => clientsApi.merge(Number(mergeTarget), Number(mergeSource)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setMergeSource('')
      setMergeTarget('')
    },
  })

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl text-surface-900 mb-6">Paramètres</h1>

      {/* Account */}
      <section className="bg-white rounded-2xl border border-surface-200 shadow-card p-6 mb-5">
        <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-4">Compte</h2>
        <div className="flex items-center gap-4">
          {user?.picture && <img src={user.picture} className="w-10 h-10 rounded-full" alt="" />}
          <div>
            <p className="font-medium text-surface-900">{user?.name}</p>
            <p className="text-sm text-surface-500">{user?.email}</p>
          </div>
          <button onClick={logout}
            className="ml-auto text-sm text-red-500 hover:text-red-700 border border-red-200
                       hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all">
            Se déconnecter
          </button>
        </div>
      </section>

      {/* Calendar sync */}
      <section className="bg-white rounded-2xl border border-surface-200 shadow-card p-6 mb-5">
        <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-4">
          Google Calendar
        </h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-surface-800">
              {calStatus?.connected ? '✓ Connecté' : 'Non connecté'}
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              {calStatus?.total_synced ?? 0} événements synchronisés
            </p>
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl
                       text-sm hover:bg-brand-600 disabled:opacity-60 transition-colors"
          >
            {syncMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />}
            Synchroniser
          </button>
        </div>
        {syncMutation.isSuccess && (
          <p className="text-sm text-green-600">✓ {syncMutation.data?.data?.synced} événements importés</p>
        )}
      </section>

      {/* Exclusion rules */}
      <section className="bg-white rounded-2xl border border-surface-200 shadow-card p-6 mb-5">
        <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-1">
          Règles d'exclusion
        </h2>
        <p className="text-xs text-surface-400 mb-4">
          Définissez quels événements ignorer lors de la synchronisation (réunions internes, blocs personnels…).
        </p>
        <ExclusionRulesPanel />
      </section>

      {/* Merge clients */}
      <section className="bg-white rounded-2xl border border-surface-200 shadow-card p-6">
        <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-1">
          Fusionner des clients
        </h2>
        <p className="text-xs text-surface-400 mb-4">
          Fusionnez deux fiches client détectées comme étant la même entité.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-surface-500 block mb-1">Source (sera supprimé)</label>
            <select
              value={mergeSource}
              onChange={e => setMergeSource(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl
                         bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Choisir…</option>
              {clients.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500 block mb-1">Cible (sera conservé)</label>
            <select
              value={mergeTarget}
              onChange={e => setMergeTarget(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl
                         bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Choisir…</option>
              {clients.filter((c: any) => String(c.id) !== mergeSource).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => mergeMutation.mutate()}
          disabled={!mergeSource || !mergeTarget || mergeMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-surface-900 text-white rounded-xl
                     text-sm hover:bg-surface-700 disabled:opacity-40 transition-colors"
        >
          {mergeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
          Fusionner
        </button>
        {mergeMutation.isSuccess && <p className="text-sm text-green-600 mt-2">✓ Fusion effectuée</p>}
      </section>
    </div>
  )
}
