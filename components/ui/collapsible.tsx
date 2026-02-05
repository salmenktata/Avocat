'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CollapsibleContextType {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextType>({
  open: false,
  onOpenChange: () => {},
})

interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

const Collapsible = ({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
  className,
}: CollapsibleProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps {
  asChild?: boolean
  children: React.ReactNode
  className?: string
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ asChild, children, className, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(CollapsibleContext)

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        onClick: () => onOpenChange(!open),
        'aria-expanded': open,
      })
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={className}
        {...props}
      >
        {children}
      </button>
    )
  }
)

CollapsibleTrigger.displayName = 'CollapsibleTrigger'

interface CollapsibleContentProps {
  children: React.ReactNode
  className?: string
}

const CollapsibleContent = ({ children, className }: CollapsibleContentProps) => {
  const { open } = React.useContext(CollapsibleContext)

  if (!open) return null

  return <div className={cn('animate-in fade-in-0', className)}>{children}</div>
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
