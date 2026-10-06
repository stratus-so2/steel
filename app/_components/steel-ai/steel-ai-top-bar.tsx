'use client'

import {
  AiMagicIcon,
  Menu01Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSteelAiWorkspace } from './steel-ai-context'
import { SteelAiHistory } from './steel-ai-history'

/**
 * Header of the Steel AI screens. On small screens the context sidebar is
 * hidden, so the history opens in a Sheet from here.
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
    <div className='sticky top-0 z-18 flex h-11 w-full shrink-0 items-center gap-2 border-b border-secondary bg-primary-foreground px-3 md:px-5'>
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Histórico de conversas'
        className='md:hidden'
        onClick={() => setOpen(true)}
      >
        <SteelIcon icon={Menu01Icon} strokeWidth={2} />
      </Button>
      <div className='flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-xs'>
        <SteelIcon
          icon={AiMagicIcon}
          strokeWidth={2}
          className='shrink-0 text-primary'
        />
        <span className='shrink-0'>Steel AI</span>
        {title ? (
          <>
            <span className='text-muted-foreground'>/</span>
            <span className='truncate'>{title}</span>
          </>
        ) : null}
      </div>
      {actions}
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Novo chat'
        className='md:hidden'
        render={<Link href={`/${slug}/ai`} />}
        nativeButton={false}
      >
        <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side='left' className='w-80 p-4'>
          <SheetHeader className='p-0'>
            <SheetTitle>Conversas</SheetTitle>
          </SheetHeader>
          <div className='min-h-0 flex-1 overflow-y-auto'>
            <SteelAiHistory onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
