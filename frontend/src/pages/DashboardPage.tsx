import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO, isToday } from 'date-fns'
import { clientsApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useDateLocale } from '../hooks/useDateLocale'
import { CalendarCheck, Users, Clock, ArrowRight } from 'lucide-react'
import logoLight from '../assets/logo-light.png'

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-card p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <p className="text-2xl font-semibold text-surface-900">{value}</p>
      <p className="text-sm text-surface-500 mt-0.5">{label}</p>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dateLocale = useDateLocale()

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list().then(r => r.data),
  })

  const totalMeetings = clients.reduce((s: number, c: any) => s + c.total_meetings, 0)
  const withUpcoming  = clients.filter((c: any) => c.next_meeting).length

  const upcoming = clients
    .filter((c: any) => c.next_meeting)
    .sort((a: any, b: any) =>
      new Date(a.next_meeting.start_time).getTime() - new Date(b.next_meeting.start_time).getTime()
    )
    .slice(0, 5)

  const recent = clients
    .filter((c: any) => c.last_meeting)
    .sort((a: any, b: any) =>
      new Date(b.last_meeting.start_time).getTime() - new Date(a.last_meeting.start_time).getTime()
    )
    .slice(0, 8)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-surface-900">
            {t('dashboard.greeting', { name: user?.name?.split(' ')[0] })}
          </h1>
          <p className="text-surface-500 mt-1">
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: dateLocale })}
          </p>
        </div>
        <img src={logoLight} alt="Flying Wings" className="w-16 h-16 object-contain opacity-90" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Users}         label={t('dashboard.clientsTracked')} value={clients.length} color="bg-brand-500" />
        <StatCard icon={CalendarCheck} label={t('dashboard.totalMeetings')}  value={totalMeetings}  color="bg-emerald-500" />
        <StatCard icon={Clock}         label={t('client.upcoming')}          value={withUpcoming}   color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Upcoming meetings */}
        <div className="col-span-3">
          <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-3">
            {t('dashboard.upcomingMeetings')}
          </h2>
          <div className="space-y-2">
            {upcoming.length === 0 && !isLoading && (
              <div className="bg-white rounded-2xl border border-surface-200 p-6 text-center text-sm text-surface-400">
                {t('dashboard.syncPrompt')}
              </div>
            )}
            {upcoming.map((c: any) => {
              const dt = parseISO(c.next_meeting.start_time)
              const todayFlag = isToday(dt)
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/client/${c.id}`)}
                  className="bg-white rounded-2xl border border-surface-200 shadow-card
                             p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover
                             hover:border-brand-200 transition-all group"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center
                                text-xs font-semibold shrink-0"
                    style={{ background: c.color + '22', color: c.color }}
                  >
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{c.name}</p>
                    <p className="text-xs text-surface-500 truncate">{c.next_meeting.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {todayFlag
                      ? <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{t('common.today')}</span>
                      : <span className="text-xs text-surface-600">{format(dt, 'd MMM', { locale: dateLocale })}</span>
                    }
                    <p className="text-xs text-surface-400 mt-0.5">{format(dt, 'HH:mm')}</p>
                  </div>
                  <ArrowRight size={14} className="text-surface-300 group-hover:text-brand-400 shrink-0 transition-colors" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent clients */}
        <div className="col-span-2">
          <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-3">
            {t('dashboard.recentClients')}
          </h2>
          <div className="bg-white rounded-2xl border border-surface-200 shadow-card divide-y divide-surface-100">
            {recent.map((c: any) => (
              <button
                key={c.id}
                onClick={() => navigate(`/client/${c.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left
                           hover:bg-surface-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center
                              text-xs font-semibold shrink-0"
                  style={{ background: c.color + '22', color: c.color }}
                >
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{c.name}</p>
                </div>
                <p className="text-xs text-surface-400 shrink-0">
                  {c.last_meeting && format(parseISO(c.last_meeting.start_time), 'd MMM', { locale: dateLocale })}
                </p>
              </button>
            ))}
            {recent.length === 0 && (
              <p className="text-sm text-surface-400 text-center py-8 px-4">{t('dashboard.noClients')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
