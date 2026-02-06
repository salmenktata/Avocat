'use client'

import { useState, useCallback, useEffect } from 'react'
import { SuperAdminSidebar } from './SuperAdminSidebar'
import { SuperAdminTopbar } from './SuperAdminTopbar'
import { cn } from '@/lib/utils'

interface SuperAdminLayoutProps {
  children: React.ReactNode
  user: {
    email: string
    nom?: string
    prenom?: string
  }
  pendingCount?: number
  unreadNotifications?: number
}

const STORAGE_KEY = 'super-admin-sidebar-collapsed'

export function SuperAdminLayout({
  children,
  user,
  pendingCount = 0,
  unreadNotifications = 0
}: SuperAdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Récupérer l'état depuis localStorage au montage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
    setMounted(true)
  }, [])

  const handleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const newValue = !prev
      localStorage.setItem(STORAGE_KEY, String(newValue))
      return newValue
    })
  }, [])

  // Éviter le flash de contenu
  if (!mounted) {
    return (
      <div className="flex h-screen bg-slate-950">
        <div className="w-64 bg-slate-900 border-r border-slate-700" />
        <div className="flex-1" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <SuperAdminSidebar
        collapsed={collapsed}
        onCollapse={handleCollapse}
        pendingCount={pendingCount}
        unreadNotifications={unreadNotifications}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <SuperAdminTopbar
          user={user}
          pendingCount={pendingCount}
          unreadNotifications={unreadNotifications}
        />

        {/* Page content */}
        <main className={cn(
          'flex-1 overflow-y-auto bg-slate-950 p-6',
          'text-slate-100'
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}
