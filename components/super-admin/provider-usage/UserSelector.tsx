'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/lib/icons'

interface UserSelectorProps {
  currentUserId: string | null
  days: number
}

interface UserData {
  id: string
  email: string
  nom: string
  prenom: string
  plan: string
  totalOperations: number
  totalTokens: number
  totalCost: number
}

interface UserSummaryResponse {
  users: UserData[]
  period: {
    start: string
    end: string
    days: number
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function UserSelector({ currentUserId, days }: UserSelectorProps) {
  const router = useRouter()
  const { data, isLoading } = useSWR<UserSummaryResponse>(
    `/api/admin/user-consumption-summary?days=${days}`,
    fetcher
  )

  const handleSelect = (userId: string) => {
    const params = new URLSearchParams()
    params.set('days', days.toString())
    if (userId && userId !== 'all') {
      params.set('userId', userId)
    }
    router.push(`/super-admin/provider-usage?${params}`)
  }

  return (
    <Select
      value={currentUserId || 'all'}
      onValueChange={handleSelect}
      disabled={isLoading}
    >
      <SelectTrigger className="w-80 bg-slate-800 border-slate-700 text-white">
        <SelectValue placeholder="Sélectionner un utilisateur" />
      </SelectTrigger>
      <SelectContent className="bg-slate-800 border-slate-700">
        <SelectItem value="all" className="text-white hover:bg-slate-700">
          <div className="flex items-center gap-2">
            <Icons.users className="h-4 w-4" />
            <span>Tous les utilisateurs</span>
          </div>
        </SelectItem>
        {data?.users.map((user) => (
          <SelectItem
            key={user.id}
            value={user.id}
            className="text-white hover:bg-slate-700"
          >
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {user.prenom} {user.nom}
                </span>
                <span className="text-xs text-slate-400">({user.email})</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                {user.plan}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
