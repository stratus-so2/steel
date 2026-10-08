'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ShortcutHint } from '@/app/_components/shortcuts/shortcut-kbd'
import { buttonVariants } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * One rail entry. The label shows from `lg` up; below that the rail is
 * icon-only and the name moves to a tooltip (and is always the link's
 * accessible name). With a `shortcut`, the tooltip shows at every width
 * with the keys (`ServiceDesk  G S`).
 */
export function GlobalButtonNavigation({
  linkNavigation,
  children,
  description,
  active = false,
  shortcut,
}: {
  linkNavigation: string
  children: ReactNode
  description: string
  active?: boolean
  shortcut?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={linkNavigation}
            aria-label={description}
            aria-current={active ? 'page' : undefined}
            className='group/global flex flex-col items-center justify-center rounded-md text-muted-foreground outline-none'
          />
        }
      >
        <span
          className={cn(
            buttonVariants({
              variant: active ? 'secondary' : 'ghost',
              size: 'icon',
            }),
            'relative group-focus-visible/global:ring-[3px] group-focus-visible/global:ring-ring/50',
          )}
        >
          {children}
        </span>
        <span className='hidden text-sm font-medium text-muted-foreground lg:block'>
          {description}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side='right'
        className={shortcut ? undefined : 'lg:hidden'}
      >
        {shortcut ? (
          <ShortcutHint id={shortcut} label={description} />
        ) : (
          description
        )}
      </TooltipContent>
    </Tooltip>
  )
}
