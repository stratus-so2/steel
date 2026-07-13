import {
  PanelLeftIcon,
  SlidersHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  ContextHeader,
  ContextPrimaryAction,
  ContextSidebar,
} from '@/app/_components/navigation/sidebar-context'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: '',
  description: '',
}

export default function AiLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContextSidebar>
        <ContextHeader
          title='Steel IA'
          actions={
            <Button variant='ghost' size='icon-sm'>
              <SteelIcon icon={PanelLeftIcon} strokeWidth={2} />
            </Button>
          }
          primaryAction={
            <ContextPrimaryAction>
              <SteelIcon icon={SlidersHorizontalIcon} />
              Novo chat
            </ContextPrimaryAction>
          }
        />
      </ContextSidebar>
      {children}
    </>
  )
}
