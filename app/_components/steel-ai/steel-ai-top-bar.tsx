'use client'

import { AiMagicIcon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSteelAiWorkspace } from './steel-ai-context'

/**
 * Light header of the Steel AI screens (no border; same height as the
 * context sidebar header row). On small screens the history, "Novo chat"
 * and "Agentes" live in the app's mobile navigation drawer (the Steel AI
 * ContextSidebar is mirrored there), so this bar only keeps a quick "new
 * chat" button and lets the title use the room. Keep `actions` compact
 * (icon-only under `sm`).
 */
export function SteelAiTopBar({
  title,
  actions,
}: {
  title?: string
  actions?: ReactNode
}) {
  const { slug } = useSteelAiWorkspace()

  return (
    <div className='flex h-12 w-full min-w-0 shrink-0 items-center gap-1 bg-primary-foreground px-3 sm:gap-2 sm:px-4'>
      <div className='flex min-w-0 flex-1 items-center gap-1.5 text-sm'>
        <SteelIcon
          icon={AiMagicIcon}
          strokeWidth={2}
          className={cn(
            'size-4 shrink-0 text-primary',
            title && 'hidden sm:block',
          )}
        />
        <span
          className={cn(
            'shrink-0',
            title
              ? 'hidden text-muted-foreground sm:inline'
              : 'font-medium text-foreground',
          )}
        >
          Steel AI
        </span>
        {title ? (
          <>
            <span
              aria-hidden
              className='hidden text-muted-foreground/60 sm:inline'
            >
              /
            </span>
            <span className='truncate font-medium'>{title}</span>
          </>
        ) : null}
      </div>
      {actions ? (
        <div className='flex shrink-0 items-center gap-1'>{actions}</div>
      ) : null}
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Novo chat'
        className='shrink-0 md:hidden'
        render={<Link href={`/${slug}/ai`} />}
        nativeButton={false}
      >
        <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
      </Button>
    </div>
  )
}
