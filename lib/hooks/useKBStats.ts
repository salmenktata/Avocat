'use client'

import { useQuery } from '@tanstack/react-query'

export interface KBStats {
  totalDocuments: number
  byCategory: Record<string, number>
}

async function fetchKBStats(): Promise<KBStats> {
  const res = await fetch('/api/client/kb/stats')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function useKBStats() {
  return useQuery({
    queryKey: ['kb-stats'],
    queryFn: fetchKBStats,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
