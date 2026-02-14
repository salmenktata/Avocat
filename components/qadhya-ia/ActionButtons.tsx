'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/button'

export type ActionType = 'chat' | 'structure' | 'consult'

interface ActionButtonsProps {
  selected: ActionType
  onSelect: (action: ActionType) => void
  disabled?: boolean
}

export function ActionButtons({ selected, onSelect, disabled }: ActionButtonsProps) {
  const t = useTranslations('qadhyaIA.actions')

  const actions: Array<{
    type: ActionType
    label: string
    icon: keyof typeof Icons
    description: string
  }> = [
    {
      type: 'chat',
      label: t('chat.label'),
      icon: 'messageSquare',
      description: t('chat.description'),
    },
    {
      type: 'structure',
      label: t('structure.label'),
      icon: 'edit',
      description: t('structure.description'),
    },
    {
      type: 'consult',
      label: t('consult.label'),
      icon: 'scale',
      description: t('consult.description'),
    },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {actions.map((action) => {
        const Icon = Icons[action.icon]
        const isSelected = selected === action.type

        return (
          <Button
            key={action.type}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            disabled={disabled}
            onClick={() => onSelect(action.type)}
            className={cn(
              'flex-1 justify-start',
              isSelected && 'ring-2 ring-primary ring-offset-2'
            )}
          >
            <Icon className="mr-2 h-4 w-4" />
            <div className="flex flex-col items-start">
              <span className="font-medium">{action.label}</span>
              <span className="text-xs opacity-70 hidden sm:block">{action.description}</span>
            </div>
          </Button>
        )
      })}
    </div>
  )
}
