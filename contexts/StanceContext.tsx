'use client'

import { createContext, useContext, useState } from 'react'
import type { LegalStance } from '@/lib/ai/legal-reasoning-prompts'

const STORAGE_KEY = 'qadhya_stance'

interface StanceContextValue {
  stance: LegalStance
  setStance: (s: LegalStance) => void
}

export const StanceContext = createContext<StanceContextValue>({
  stance: 'defense',
  setStance: () => {},
})

function readStoredStance(): LegalStance {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'defense' || stored === 'attack' || stored === 'neutral') {
    return stored
  }
  return 'defense'
}

export function StanceProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer : lit localStorage dès le premier rendu (pas de flash)
  const [stance, setStanceState] = useState<LegalStance>(readStoredStance)

  const setStance = (s: LegalStance) => {
    setStanceState(s)
    localStorage.setItem(STORAGE_KEY, s)
  }

  return (
    <StanceContext.Provider value={{ stance, setStance }}>
      {children}
    </StanceContext.Provider>
  )
}

export function useStance() {
  return useContext(StanceContext)
}
