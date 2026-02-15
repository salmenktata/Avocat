'use client'

/**
 * UnifiedChatPage - Interface unifiée Qadhya IA
 *
 * Fusion des 3 pages: Chat, Structuration, Consultation
 * Actions contextuelles pour choisir le mode d'interaction
 */

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { FeatureErrorBoundary } from '@/components/providers/FeatureErrorBoundary'
import { ActionButtons, type ActionType } from '@/components/qadhya-ia/ActionButtons'
import { EnrichedMessage } from '@/components/qadhya-ia/EnrichedMessage'
import { MODE_CONFIGS } from './mode-config'
import {
  ConversationsList,
  type Conversation as ConvType,
} from '@/components/assistant-ia/ConversationsList'
import {
  ChatMessages,
  type ChatMessage,
} from '@/components/assistant-ia/ChatMessages'
import {
  ChatInput,
} from '@/components/assistant-ia/ChatInput'
import {
  useConversationList,
  useConversation,
  useSendMessage,
  useDeleteConversation,
} from '@/lib/hooks/useConversations'

interface UnifiedChatPageProps {
  userId: string
  initialAction?: ActionType  // 'chat' | 'structure' | 'consult'
  hideActionButtons?: boolean // Masquer les boutons si page dédiée
}

export function UnifiedChatPage({
  userId,
  initialAction = 'chat',
  hideActionButtons = false
}: UnifiedChatPageProps) {
  const t = useTranslations('qadhyaIA')
  const router = useRouter()
  const { toast } = useToast()

  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [currentAction, setCurrentAction] = useState<ActionType>(initialAction)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Mode config dérivée de l'action courante
  const modeConfig = useMemo(() => MODE_CONFIGS[currentAction], [currentAction])
  const ModeIcon = useMemo(() => Icons[modeConfig.icon], [modeConfig.icon])

  // React Query hooks - Cache automatique
  const {
    data: conversationsData,
    isLoading: isLoadingConversations,
  } = useConversationList({
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 50,
    actionType: currentAction,
  })

  const {
    data: selectedConversation,
    isLoading: isLoadingMessages,
  } = useConversation(selectedConversationId || '', {
    enabled: !!selectedConversationId,
  })

  // Mutations avec optimistic updates
  const { mutate: sendMessage, isPending: isSending } = useSendMessage({
    onSuccess: (data) => {
      // Si nouvelle conversation, la sélectionner
      if (!selectedConversationId && data.conversation.id) {
        setSelectedConversationId(data.conversation.id)
      }

      // Si c'est une structuration avec dossierId, rediriger
      if (currentAction === 'structure' && (data as any).dossierId) {
        router.push(`/dossiers/${(data as any).dossierId}`)
      }
    },
    onError: (error) => {
      toast({
        title: t('errors.sendFailed'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const { mutate: deleteConversation } = useDeleteConversation({
    onSuccess: () => {
      toast({
        title: t('success.deleted'),
      })
    },
    onError: (error) => {
      toast({
        title: t('errors.deleteFailed'),
        variant: 'destructive',
      })
    },
  })

  // Données dérivées
  const conversations = useMemo(() =>
    (conversationsData?.conversations || []).map((c) => ({
      ...c,
      title: c.title as string | null,
    })) as ConvType[],
    [conversationsData?.conversations]
  )

  const messages: ChatMessage[] = useMemo(() =>
    (selectedConversation?.messages || [])
      .filter((m) => m.role !== 'system')
      .map((m) => {
        // Sources directement sur m (via fetchConversation) OU dans metadata (legacy)
        const rawSources = (m as any).sources || m.metadata?.sources
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: m.timestamp,
          sources: rawSources?.map((s: any) => ({
            documentId: s.documentId || s.id,
            documentName: s.documentName || s.title,
            chunkContent: s.chunkContent || '',
            similarity: s.similarity,
          })),
          abrogationAlerts: m.metadata?.abrogationAlerts,
          qualityIndicator: m.metadata?.qualityIndicator,
          metadata: m.metadata, // Conserver metadata pour actionType
        } as any
      }),
    [selectedConversation?.messages]
  )

  // Handlers
  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId(id)
    setSidebarOpen(false)
  }, [])

  const handleNewConversation = useCallback(() => {
    setSelectedConversationId(null)
    setSidebarOpen(false)
  }, [])

  const handleDeleteConversation = useCallback((id: string) => {
    if (selectedConversationId === id) {
      setSelectedConversationId(null)
    }
    deleteConversation(id)
  }, [selectedConversationId, deleteConversation])

  const handleSendMessage = useCallback((content: string) => {
    sendMessage({
      conversationId: selectedConversationId || undefined,
      message: content,
      usePremiumModel: false,
      // Ajout du actionType dans les metadata (sera géré par l'API)
      actionType: currentAction,
    } as any)
  }, [selectedConversationId, currentAction, sendMessage])

  const handleActionSelect = useCallback((action: ActionType) => {
    setCurrentAction(action)
  }, [])

  // Placeholder dynamique selon l'action
  const getPlaceholder = () => {
    switch (currentAction) {
      case 'chat':
        return t('placeholders.chat')
      case 'structure':
        return t('placeholders.structure')
      case 'consult':
        return t('placeholders.consult')
    }
  }

  // Sidebar pour mobile et desktop
  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2.5 mb-1">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', modeConfig.iconBgClass)}>
            <ModeIcon className={cn('h-4 w-4', modeConfig.iconTextClass)} />
          </div>
          <div>
            <h2 className="font-semibold text-sm tracking-tight">{t('title')}</h2>
            <p className="text-[11px] text-muted-foreground">{t(`actions.${modeConfig.translationKey}.description`)}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ConversationsList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDelete={handleDeleteConversation}
          isLoading={isLoadingConversations}
        />
      </div>
    </div>
  )

  return (
    <FeatureErrorBoundary
      featureName="Qadhya IA"
      fallbackAction={{
        label: "Retour à l'accueil",
        onClick: () => router.push('/dashboard'),
      }}
    >
      <div className={cn('h-[calc(100vh-4rem)] flex bg-gradient-to-br', modeConfig.gradientClass)}>
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:w-72 xl:w-80 border-r flex-col bg-background/80 backdrop-blur-sm">
          {SidebarContent}
        </aside>

        {/* Zone Chat Principale */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header Mobile */}
          <div className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b bg-background/80 backdrop-blur-sm">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Icons.menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 transition-transform duration-300 ease-out">
                {SidebarContent}
              </SheetContent>
            </Sheet>
            <Badge variant="outline" className={cn('gap-1.5 text-xs', modeConfig.badgeClass)}>
              <ModeIcon className="h-3 w-3" />
              {t(`actions.${modeConfig.translationKey}.label`)}
            </Badge>
            <div className="w-9" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto">
              <ChatMessages
                messages={messages}
                isLoading={isLoadingMessages}
                modeConfig={modeConfig}
                renderEnriched={(message) => <EnrichedMessage message={message} />}
                onSendExample={handleSendMessage}
              />
            </div>
          </div>

          {/* Zone basse : Tabs + Input */}
          <div className="border-t bg-background/80 backdrop-blur-sm">
            {/* Tabs de mode */}
            {!hideActionButtons && (
              <div className="pt-3 pb-1">
                <ActionButtons
                  selected={currentAction}
                  onSelect={handleActionSelect}
                  disabled={isSending}
                />
              </div>
            )}

            {/* Input */}
            <ChatInput
              onSend={handleSendMessage}
              disabled={isSending}
              placeholder={getPlaceholder()}
              modeConfig={modeConfig}
            />
          </div>
        </main>
      </div>
    </FeatureErrorBoundary>
  )
}
