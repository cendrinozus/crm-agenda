import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { Loader2 } from 'lucide-react'

export function AuthCallbackPage() {
  const { setTokens, fetchMe } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const access  = params.get('access_token')
    const refresh = params.get('refresh_token')

    if (access && refresh) {
      setTokens(access, refresh)
      fetchMe().then(() => navigate('/', { replace: true }))
    } else {
      navigate('/login', { replace: true })
    }
  }, [])

  return (
    <div className="h-screen flex items-center justify-center gap-3 text-surface-600">
      <Loader2 className="animate-spin" size={20} />
      {t('auth.loading')}
    </div>
  )
}
