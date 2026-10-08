'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserStickyCreateButton } from './user-sticky-create-button'
import { UserStickyList } from './user-sticky-list'

/**
 * The user's stickies anywhere in the workspace: opened from the global rail
 * (and the mobile drawer), the same list the home page shows.
 */
export function UserStickyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85dvh] flex-col gap-4 sm:max-w-4xl'>
        <DialogHeader className='flex-row items-start justify-between gap-4 pr-8'>
          <div className='space-y-1'>
            <DialogTitle>Notas adesivas</DialogTitle>
            <DialogDescription>
              Suas anotações rápidas, só você as vê.
            </DialogDescription>
          </div>
          <UserStickyCreateButton variant='outline' size='xs' />
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <UserStickyList />
        </div>
      </DialogContent>
    </Dialog>
  )
}
