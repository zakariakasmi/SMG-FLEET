import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { usersApi } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!email || !password) {
        showToast(t('login.fillAllFields'), 'error')
        setLoading(false)
        return
      }

      const userData = await usersApi.login(email.trim(), password)
      if (!userData) {
        throw new Error('NO_PROFILE')
      }
      login(userData)
      showToast(t('login.loginSuccess'), 'success')

      setTimeout(() => {
        navigate('/')
      }, 100)
    } catch (error) {
      showToast(t('login.invalidCredentials'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-y-auto overflow-x-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 8%, hsl(var(--primary) / 0.06) 0%, transparent 100%)',
        }}
      />

      <div
        className="w-full max-w-md rounded-xl overflow-hidden relative z-10 border border-border bg-card shadow-sm"
      >
        {/* Logo */}
        <div className="flex justify-center pt-8 pb-2">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SMG Fleet" className="w-10 h-10 rounded-md" />
            <h1 className="text-2xl font-bold text-foreground">
              SMG Fleet
            </h1>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-8">
          <h2 className="text-center text-xl font-semibold mb-2 text-foreground">
            {t('login.welcomeBack')}
          </h2>
          <p className="text-center text-sm mb-8 text-muted-foreground">
            {t('login.signInSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('login.email')}
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />

            <Input
              label={t('login.password')}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />

            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => showToast(t('login.forgotPassword'), 'info')}
                className="text-[13px] font-medium text-primary transition-colors"
              >
                {t('login.forgotPasswordLabel')}
              </button>
            </div>

            <Button type="submit" className="w-full mt-2" loading={loading}>
              {t('login.signIn')}
            </Button>
          </form>

          <p
            className="text-center text-xs mt-6 text-muted-foreground/50"
          >
            {t('login.systemVersion')}
          </p>
        </div>
      </div>
    </div>
  )
}