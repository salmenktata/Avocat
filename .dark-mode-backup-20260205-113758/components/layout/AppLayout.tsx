'use client'

import * as React from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  user: {
    email: string
    nom?: string
    prenom?: string
  }
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Charger l'état sauvegardé au montage
  React.useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved) {
      setCollapsed(JSON.parse(saved))
    }
  }, [])

  // Détecter la taille d'écran pour le responsive
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="relative flex min-h-screen">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} />
      )}

      {/* Mobile Menu Button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-4 top-4 z-50 lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Icons.menu className="h-6 w-6" />
        </Button>
      )}

      {/* Mobile Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar collapsed={false} onCollapse={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Topbar user={user} />
        <main className={cn(
          'flex-1 overflow-y-auto',
          'px-4 py-6 sm:px-6 lg:px-8'
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}
