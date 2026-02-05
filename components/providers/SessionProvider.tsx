'use client'

/**
 * SessionProvider - Contexte de session
 *
 * Fournit le contexte d'authentification aux composants enfants.
 * Utilise notre système d'authentification HttpOnly custom.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface SessionUser {
  id: string
  email: string
  name: string
  role?: string
}

interface SessionContextType {
  user: SessionUser | null
  loading: boolean
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
})

export function useSession() {
  return useContext(SessionContext)
}

interface SessionProviderProps {
  children: ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()

      if (data.authenticated && data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [])

  return (
    <SessionContext.Provider value={{ user, loading, refresh: fetchSession }}>
      {children}
    </SessionContext.Provider>
  )
}
