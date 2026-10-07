'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
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
 * accessible name).
 */
export function GlobalButtonNavigation({
  linkNavigation,
  children,
  description,
  active = false,
}: {
  linkNavigation: string
  children: ReactNode
  description: string
  active?: boolean
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
      <TooltipContent side='right' className='lg:hidden'>
        {description}
      </TooltipContent>
    </Tooltip>
  )
}
