'use client'
import * as RadixTooltip from '@radix-ui/react-tooltip'

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayDuration?: number
}

export function Tooltip({ children, content, side = 'top', delayDuration = 200 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={4}
            className="z-50 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] shadow-lg animate-in fade-in-0 zoom-in-95"
          >
            {content}
            <RadixTooltip.Arrow className="fill-[var(--color-bg-overlay)]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
