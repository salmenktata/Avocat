'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import type { ModeConfig } from '@/app/(dashboard)/qadhya-ia/mode-config'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
  modeConfig?: ModeConfig
}

export function ChatInput({ onSend, disabled = false, placeholder, modeConfig }: ChatInputProps) {
  const t = useTranslations('assistantIA')
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const maxHeight = window.innerWidth < 768 ? 120 : 160
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    }
  }, [message])

  const handleSend = () => {
    const trimmed = message.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setMessage('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = message.trim().length > 0 && !disabled

  return (
    <div className="p-3 md:p-4">
      <div className="max-w-3xl mx-auto">
        <div className={cn(
          'relative flex items-end gap-2',
          'rounded-2xl border bg-card shadow-sm',
          'focus-within:shadow-md focus-within:border-primary/30',
          'transition-all duration-200'
        )}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('placeholder')}
            disabled={disabled}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent px-4 py-3.5',
              'text-[15px] leading-relaxed placeholder:text-muted-foreground/60',
              'focus:outline-none',
              'min-h-[48px] max-h-[120px] md:max-h-[160px]',
              'disabled:opacity-50'
            )}
          />
          <div className="flex items-center gap-1.5 pe-2 pb-2">
            <span className="hidden sm:inline-flex text-[10px] text-muted-foreground/50 me-1">
              <kbd className="px-1 py-0.5 rounded border border-border/50 bg-muted/30 font-sans">
                {'\u23CE'}
              </kbd>
            </span>
            <Button
              onClick={handleSend}
              disabled={!canSend}
              size="icon"
              className={cn(
                'h-9 w-9 rounded-xl shrink-0',
                'transition-all duration-200',
                canSend && 'hover:scale-105 active:scale-95 shadow-sm',
                !canSend && 'opacity-40'
              )}
            >
              {disabled ? (
                <Icons.loader className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.arrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
          {t('disclaimer')}
        </p>
      </div>
    </div>
  )
}
