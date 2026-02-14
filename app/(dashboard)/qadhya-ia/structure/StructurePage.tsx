'use client'

import { UnifiedChatPage } from '../UnifiedChatPage'

interface StructurePageProps {
  userId: string
}

export function StructurePage({ userId }: StructurePageProps) {
  return (
    <UnifiedChatPage
      userId={userId}
      initialAction="structure"
      hideActionButtons={true}
    />
  )
}
