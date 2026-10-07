'use client'

import {
  AiMagicIcon,
  Menu01Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import { SteelAgentsNavLink } from '@/app/_components/steel-agents/steel-agents-nav-link'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useSteelAiWorkspace } from './steel-ai-context'
import { SteelAiHistory } from './steel-ai-history'

/**
 * Light header of the Steel AI screens (no border; same height as the
 * context sidebar header row). On small screens the context sidebar is
 * hidden, so the history opens in a Sheet from here and the "Steel AI"
 * crumb gives its room to the title. Keep `actions` compact (icon-only
 * under `sm`).
 */
export function SteelAiTopBar({
  title,
  actions,
}: {
  title?: string
  actions?: ReactNode
}) {
  const { slug } = useSteelAiWorkspace()
  const [open, setOpen] = useState(false)

  return (
    <div className='flex h-12 w-full min-w-0 shrink-0 items-center gap-1 bg-primary-foreground px-2 sm:gap-2 sm:px-4'>
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Histórico de conversas'
        className='shrink-0 md:hidden'
        onClick={() => setOpen(true)}
      >
        <SteelIcon icon={Menu01Icon} strokeWidth={2} />
      </Button>
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side='left' className='w-[85vw] max-w-80 gap-3 p-3'>
          <SheetHeader className='p-1'>
            <SheetTitle>Steel AI</SheetTitle>
          </SheetHeader>
          <div className='space-y-1'>
            <Button
              variant='outline'
              className='w-full justify-start'
              render={<Link href={`/${slug}/ai`} />}
              nativeButton={false}
              onClick={() => setOpen(false)}
            >
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              Novo chat
            </Button>
            <SteelAgentsNavLink slug={slug} onNavigate={() => setOpen(false)} />
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto'>
            <SteelAiHistory onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
