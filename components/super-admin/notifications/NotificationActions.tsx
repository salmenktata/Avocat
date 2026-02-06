'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'
import { useToast } from '@/lib/hooks/use-toast'
import { markAllNotificationsReadAction } from '@/app/actions/super-admin/notifications'

interface NotificationActionsProps {
  unreadCount: number
  adminId: string
}

export function NotificationActions({ unreadCount, adminId }: NotificationActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleMarkAllRead = async () => {
    setLoading(true)
    try {
      const result = await markAllNotificationsReadAction()
      if (result.error) {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Notifications lues',
          description: `${result.count} notifications marquées comme lues`
        })
        router.refresh()
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleMarkAllRead}
      disabled={loading || unreadCount === 0}
      variant="outline"
      className="border-slate-600 text-slate-300 hover:bg-slate-700"
    >
      {loading ? (
        <Icons.loader className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Icons.checkCircle className="h-4 w-4 mr-2" />
      )}
      Tout marquer comme lu
    </Button>
  )
}
