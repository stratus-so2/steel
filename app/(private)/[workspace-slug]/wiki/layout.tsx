import {
  PanelLeftIcon,
  SlidersHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ReactNode } from 'react'
import {
  ContextHeader,
  ContextPrimaryAction,
  ContextSidebar,
} from '@/app/_components/navigation/sidebar-context'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'

export default function WikiLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContextSidebar>
        <ContextHeader
          title='Wiki'
          actions={
            <Button variant='ghost' size='icon-sm'>
              <SteelIcon icon={PanelLeftIcon} strokeWidth={2} />
            </Button>
          }
          primaryAction={
            <ContextPrimaryAction>
              <SteelIcon icon={SlidersHorizontalIcon} />
              Nova página
            </ContextPrimaryAction>
          }
        />
      </ContextSidebar>
      {children}
    </>
  )
}
