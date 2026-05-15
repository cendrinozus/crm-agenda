import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  LayoutDashboard, Settings, LogOut, RefreshCw, Search,
  ChevronRight, Loader2, ClipboardCheck
} from 'lucide-react'
import logo from '../../assets/logo.png'
import { loadSteps, getStepProgress, getStepLabel } from '../../hooks/useWorkflowSteps'

const _steps = loadSteps()
import { clientsApi, calendarApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'

export function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: clients } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list(search || undefined).then(r => r.data),
  })

  const { data: calStatus } = useQuery({
    queryKey: ['cal-status'],
    queryFn: () => calendarApi.status().then(r => r.data),
    refetchInterval: 60_000,
  })

  const pendingCount = calStatus?.pending_review ?? 0

  const syncMutation = useMutation({
    mutationFn: () => calendarApi.sync(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['cal-status'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      {/* Sidebar */}
      <aside className="w-72 flex flex-col bg-navy-900 border-r border-navy-700 shrink-0">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-navy-700">
          <div className="flex items-center gap-2.5 mb-1">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-display text-xl text-white">WINNER'S CIRCLE <span className="text-brand-400">- AGENDA</span></span>
          </div>
          {user && (
            <p className="text-xs text-white/50 ml-10 truncate">{user.email}</p>
          )}
        </div>

        {/* Main nav */}
        <nav className="px-3 pt-3 space-y-0.5">
          <NavLink to="/" end className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-white/10 text-brand-400' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`
          }>
            <LayoutDashboard size={16} /> Tableau de bord
          </NavLink>

          {/* Review queue with badge */}
          <NavLink to="/review" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-white/10 text-brand-400' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`
          }>
            <ClipboardCheck size={16} />
            <span className="flex-1">À valider</span>
            {pendingCount > 0 && (
              <span className="bg-brand-500 text-white text-xs font-semibold
                               px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {pendingCount}
              </span>
            )}
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-white/10 text-brand-400' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`
          }>
            <Settings size={16} /> Paramètres
          </NavLink>
        </nav>

        {/* Sync button */}
        <div className="px-3 pt-3">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl
                       text-sm font-medium bg-brand-500 text-white hover:bg-brand-400
                       disabled:opacity-60 transition-colors"
          >
            {syncMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />}
            {syncMutation.isPending ? 'Synchronisation…' : 'Synchroniser Calendar'}
          </button>
          {syncMutation.isSuccess && (
            <p className="text-xs text-center text-green-400 mt-1">
              ✓ {calStatus?.total_synced ?? 0} sync · {calStatus?.pending_review ?? 0} à valider
            </p>
          )}
        </div>

        {/* Client search + list */}
        <div className="flex-1 flex flex-col min-h-0 mt-4">
          <div className="px-3 mb-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un client…"
                className="w-full pl-8 pr-3 py-1.5 text-sm text-white bg-white/10 border border-white/20
                           rounded-xl placeholder-white/40 focus:outline-none focus:ring-2
                           focus:ring-brand-400 focus:bg-white/15 transition"
              />
            </div>
          </div>

          <div className="px-2 mb-1">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider px-1">
              Clients · {clients?.length ?? 0}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-0.5 pb-4">
            {clients?.map((c: any) => (
              <button
                key={c.id}
                onClick={() => navigate(`/client/${c.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                           text-left hover:bg-white/10 group transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center
                              text-xs font-semibold shrink-0"
                  style={{ background: c.color + '44', color: c.color }}
                >
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  <p className="text-xs text-white/50">{c.total_meetings} RDV</p>
                  {c.workflow_stage && (() => {
                    const pct   = getStepProgress(_steps, c.workflow_stage)
                    const label = getStepLabel(_steps, c.workflow_stage)
                    return (
                      <div className="mt-1">
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-400 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-brand-400 mt-0.5 truncate">{label}</p>
                      </div>
                    )
                  })()}
                </div>
                {c.next_meeting && (
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="RDV à venir" />
                )}
                <ChevronRight size={12} className="text-white/20 group-hover:text-white/50 shrink-0" />
              </button>
            ))}
            {clients?.length === 0 && (
              <p className="text-xs text-white/40 text-center py-8 px-4">
                Aucun client · Synchronisez votre Google Calendar
              </p>
            )}
          </div>
        </div>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-white/10 flex items-center gap-3">
          {user?.picture
            ? <img src={user.picture} className="w-7 h-7 rounded-full" alt="" />
            : <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-medium text-brand-400">
                {user?.name?.[0]}
              </div>}
          <span className="flex-1 text-sm text-white/80 truncate">{user?.name}</span>
          <button onClick={logout} className="text-white/30 hover:text-red-400 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <Outlet />
      </main>
    </div>
  )
}
