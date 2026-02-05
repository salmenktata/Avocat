'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    console.log('🔐 [LOGIN] Début connexion...')
    console.log('🔐 [LOGIN] Email:', email)

    try {
      // 1. Obtenir le CSRF token
      console.log('🔐 [LOGIN] Récupération CSRF token...')
      const csrfRes = await fetch('/api/auth/csrf')
      console.log('🔐 [LOGIN] CSRF Response status:', csrfRes.status)
      const csrfData = await csrfRes.json()
      const csrfToken = csrfData.csrfToken
      console.log('🔐 [LOGIN] CSRF Token obtenu:', csrfToken ? '✓' : '✗')

      // 2. Envoyer les credentials
      console.log('🔐 [LOGIN] Envoi credentials...')
      const res = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          csrfToken,
          email,
          password,
        }),
        redirect: 'manual',
      })

      console.log('🔐 [LOGIN] Response type:', res.type)
      console.log('🔐 [LOGIN] Response status:', res.status)

      // 3. Vérifier le résultat
      if (res.type === 'opaqueredirect' || res.status === 302 || res.status === 200) {
        console.log('🔐 [LOGIN] Auth OK, vérification session...')

        const sessionRes = await fetch('/api/auth/session')
        console.log('🔐 [LOGIN] Session status:', sessionRes.status)
        const session = await sessionRes.json()
        console.log('🔐 [LOGIN] Session:', session)

        if (session?.user) {
          console.log('🔐 [LOGIN] ✅ Connecté! Redirection...')
          window.location.replace('/dashboard')
          return
        } else {
          console.log('🔐 [LOGIN] ❌ Pas de session user')
        }
      }

      // Erreur d'authentification
      console.log('🔐 [LOGIN] ❌ Échec authentification')
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } catch (err: any) {
      console.error('🔐 [LOGIN] ❌ Exception:', err)
      setError(err?.message || 'Erreur de connexion')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-blue-900">{tCommon('appName')}</h1>
        <p className="mt-2 text-muted-foreground">{t('loginTitle')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder="votre@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            {t('password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? `${tCommon('loading')}` : t('loginButton')}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
          {tCommon('register')}
        </Link>
      </div>
    </div>
  )
}
