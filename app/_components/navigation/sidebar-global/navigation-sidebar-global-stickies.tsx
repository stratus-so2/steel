'use client'

import { StickyNote02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { UserStickyDialog } from '@/app/_components/user/sticky/user-sticky-dialog'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const LABEL = 'Stickies'

/** Last rail entry, under Ajustes: opens the user's stickies in a modal. */
export function GlobalStickiesButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type='button'
              aria-label={LABEL}
              aria-haspopup='dialog'
              onClick={() => setOpen(true)}
              className='group/global flex cursor-pointer flex-col items-center justify-center rounded-md text-muted-foreground outline-none'
            />
          }
        >
          <span
            className={cn(
              buttonVariants({
                variant: open ? 'secondary' : 'ghost',
                size: 'icon',
              }),
              'relative group-focus-visible/global:ring-[3px] group-focus-visible/global:ring-ring/50',
            )}
          >
            <SteelIcon icon={StickyNote02Icon} className='size-5' />
          </span>
          <span className='hidden text-sm font-medium text-muted-foreground lg:block'>
            {LABEL}
          </span>
        </TooltipTrigger>
        <TooltipContent side='right' className='lg:hidden'>
          {LABEL}
        </TooltipContent>
      </Tooltip>
      <UserStickyDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
