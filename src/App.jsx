import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ToastProvider, useToast } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { YearProvider } from './context/YearContext'
import { AlertTriangle } from '@untitledui/icons'
import { useInactivityTimeout } from './hooks/useInactivityTimeout'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import VehiclesList from './pages/vehicles/VehiclesList'
import VehicleDetail from './pages/vehicles/VehicleDetail'
import VehicleForm from './pages/vehicles/VehicleForm'
import Import from './pages/import/Import'
import Export from './pages/export/Export'
import TachographOperations from './pages/tachograph/TachographOperations'
import TachographDemands from './pages/tachograph/TachographDemands'
import Settings from './pages/settings/Settings'
import AddUser from './pages/settings/AddUser'
import Modal from './components/ui/Modal'
import Button from './components/ui/Button'
import { UnsavedChangesProvider } from './components/ui/UnsavedChangesGuard'
import { DEMAND_ACCESS_SCOPES } from './constants/permissions'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background text-foreground"
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

// `scope` is an all-of gate, `scopes` an any-of gate. `fallback` is where to
// send a user who is signed in but lacks the permission, instead of "/".
function PermittedRoute({ scope, scopes, fallback = '/', children }) {
  const { can, loading } = useAuth()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background text-foreground"
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"
        />
      </div>
    )
  }

  if (scope && !can(scope)) {
    return <Navigate to={fallback} replace />
  }

  if (scopes && !scopes.some((s) => can(s))) {
    return <Navigate to={fallback} replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background text-foreground"
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"
        />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background text-foreground"
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"
        />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}

function InactivityProvider({ children }) {
  const { logout } = useAuth()
  const { t } = useTranslation()
  const { showToast } = useToast()

  const { showWarning, resetTimer } = useInactivityTimeout(
    logout,
    null,
    () => showToast(t('session.sessionExpired'), 'info')
  )

  return (
    <>
      {children}
      <Modal
        isOpen={showWarning}
        onClose={resetTimer}
        title={t('session.warningTitle')}
        size="sm"
        footer={
          <Button variant="primary" onClick={resetTimer}>
            {t('session.stayLoggedIn')}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-[15px] text-muted-foreground">
            {t('session.warningMessage')}
          </p>
          <div
            className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
            <p className="text-sm font-medium text-warning">
              {t('session.warningHint')}
            </p>
          </div>
        </div>
      </Modal>
    </>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />

      <Route path="/" element={
        <ProtectedRoute>
          <InactivityProvider>
            <Layout />
          </InactivityProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="vehicles" element={<PermittedRoute scope="vehicles"><VehiclesList /></PermittedRoute>} />
        <Route path="vehicles/new" element={<PermittedRoute scope="addVehicles"><VehicleForm /></PermittedRoute>} />
        <Route path="vehicles/:code" element={<PermittedRoute scope="vehicles"><VehicleDetail /></PermittedRoute>} />
        <Route path="vehicles/:code/edit" element={<PermittedRoute scope="editVehicles"><VehicleForm /></PermittedRoute>} />
        <Route path="import" element={<PermittedRoute scope="import"><Import /></PermittedRoute>} />
        <Route path="export" element={<PermittedRoute scope="export"><Export /></PermittedRoute>} />
        <Route path="tachograph" element={<PermittedRoute scope="tachograph" fallback="/tachograph/demandes"><TachographOperations /></PermittedRoute>} />
        <Route path="tachograph/demandes" element={<PermittedRoute scopes={DEMAND_ACCESS_SCOPES}><TachographDemands /></PermittedRoute>} />
        {/* Old tab routes (due / suppliers / tariffs) are gone: send bookmarks
            back to the operations list. */}
        <Route path="tachograph/*" element={<Navigate to="/tachograph" replace />} />
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="settings/account" element={<Settings initialTab="account" />} />
        <Route path="settings/users" element={<AdminRoute><Settings initialTab="users" /></AdminRoute>} />
        <Route path="settings/users/new" element={<AdminRoute><AddUser /></AdminRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <YearProvider>
              <UnsavedChangesProvider>
                <AppRoutes />
              </UnsavedChangesProvider>
            </YearProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}