'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface SplitButtonOption {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
  badge?: string
}

interface SplitButtonProps {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  options: SplitButtonOption[]
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  className?: string
}

export function SplitButton({
  label,
  icon,
  onClick,
  options,
  disabled = false,
  loading = false,
  variant = 'default',
  className,
}: SplitButtonProps) {
  return (
    <div className="flex">
      {/* Bouton principal (partie gauche) */}
      <Button
        onClick={onClick}
        disabled={disabled || loading}
        variant={variant}
        className={cn(
          'rounded-r-none border-r-0',
          className
        )}
      >
        {loading ? (
          <Icons.loader className="h-4 w-4 animate-spin mr-2" />
        ) : (
          icon && <span className="mr-2">{icon}</span>
        )}
        {label}
      </Button>

      {/* Dropdown (partie droite) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={disabled || loading}
            variant={variant}
            className={cn(
              'rounded-l-none px-2 border-l',
              variant === 'default' && 'border-l-white/20',
              variant === 'outline' && 'border-l-slate-600',
              className
            )}
          >
            <Icons.chevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 min-w-[200px]">
          {options.map((option, index) => (
            <DropdownMenuItem
              key={index}
              onClick={option.onClick}
              disabled={option.disabled}
              className={cn(
                'text-slate-200 hover:bg-slate-700 cursor-pointer',
                option.className
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {option.icon && <span className="h-4 w-4">{option.icon}</span>}
                  <span>{option.label}</span>
                </div>
                {option.badge && (
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-400">
                    {option.badge}
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
