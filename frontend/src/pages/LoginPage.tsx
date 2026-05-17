import { useTranslation } from 'react-i18next'
import logo from '../assets/logo.png'

export function LoginPage() {
  const { t } = useTranslation()

  const handleLogin = () => {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img src={logo} alt="Flying Wings" className="w-28 h-28 object-contain mb-4" />
          <h1 className="font-display text-3xl text-surface-900">Flying <span className="text-brand-500">Wings</span></h1>
          <p className="text-surface-500 text-sm mt-1">{t('login.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-card border border-surface-200 p-8">
          <h2 className="text-lg font-semibold text-surface-900 mb-1">{t('login.title')}</h2>
          <p className="text-sm text-surface-500 mb-6">{t('login.description')}</p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3
                       bg-white border-2 border-surface-200 rounded-xl text-sm font-medium
                       text-surface-800 hover:border-brand-400 hover:bg-brand-50
                       transition-all shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t('login.google')}
          </button>

          <p className="text-xs text-surface-400 text-center mt-4">{t('login.readOnly')}</p>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">{t('login.privacy')}</p>
      </div>
    </div>
  )
}
