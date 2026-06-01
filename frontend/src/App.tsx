import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { DashboardPage } from './pages/DashboardPage'
import { ClientPage } from './pages/ClientPage'
import { MeetingPage } from './pages/MeetingPage'
import { SettingsPage } from './pages/SettingsPage'
import { ReviewQueuePage } from './pages/ReviewQueuePage'

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="h-screen flex items-center justify-center text-surface-600">Chargement…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { fetchMe } = useAuthStore()
  useEffect(() => { fetchMe() }, [])

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/auth/callback"  element={<AuthCallbackPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route index                         element={<DashboardPage />} />
            <Route path="client/:id"             element={<ClientPage />} />
            <Route path="meeting/:id"            element={<MeetingPage />} />
            <Route path="review"                 element={<ReviewQueuePage />} />
            <Route path="settings"               element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
