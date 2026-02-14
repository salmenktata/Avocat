'use client'

import { UnifiedChatPage } from '../UnifiedChatPage'

interface ConsultPageProps {
  userId: string
}

export function ConsultPage({ userId }: ConsultPageProps) {
  return (
    <UnifiedChatPage
      userId={userId}
      initialAction="consult"
      hideActionButtons={true}
    />
  )
}
