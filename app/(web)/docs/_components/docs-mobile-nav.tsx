'use client'

import { Menu01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { DocsSearchable } from '@/src/lib/docs/search'
import { DocsSearch } from './docs-search'
import {
  DocsSidebar,
  type SidebarHome,
  type SidebarSection,
} from './docs-sidebar'

interface DocsMobileNavProps {
  nav: SidebarSection[]
  index: DocsSearchable[]
  home?: SidebarHome
  title?: string
  description?: string
}

/** Below `lg` the sidebar (and its search) lives in a sheet. */
export function DocsMobileNav({
  nav,
  index,
  home,
  title = 'Documentação',
  description = 'Manual de uso do Steel',
}: DocsMobileNavProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant='outline'
            size='sm'
            className='gap-2'
            aria-label={`Abrir o menu: ${title}`}
          >
            <SteelIcon icon={Menu01Icon} size={16} />
            Menu
          </Button>
        }
      />
      <SheetContent side='left' className='w-[85%] overflow-y-auto p-0'>
        <SheetHeader className='border-b border-border'>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className='flex flex-col gap-6 px-4 pb-8'>
          {index.length > 0 && <DocsSearch index={index} onNavigate={close} />}
          <DocsSidebar nav={nav} home={home} onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
