import { useParams, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { meetingsApi } from '../services/api'

export function MeetingPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['meeting-redirect', id],
    queryFn: () => meetingsApi.get(Number(id)).then(r => r.data),
  })

  if (isLoading) return <div className="p-8 text-sm text-surface-400">{t('meeting.loading')}</div>
  if (data?.client_id) return <Navigate to={`/client/${data.client_id}`} replace />
  return <div className="p-8 text-sm text-surface-400">{t('meeting.noClient')}</div>
}
