'use client'

import { UnifiedChatPage } from '../UnifiedChatPage'

interface ChatPageProps {
  userId: string
}

export function ChatPage({ userId }: ChatPageProps) {
  return (
    <UnifiedChatPage
      userId={userId}
      initialAction="chat"
      hideActionButtons={true}
    />
  )
}
