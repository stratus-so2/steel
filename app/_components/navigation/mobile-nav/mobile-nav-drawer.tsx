'use client'

import {
  Cancel01Icon,
  Menu01Icon,
  StickyNote02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, type MouseEvent, useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { UserStickyDialog } from '../../user/sticky/user-sticky-dialog'
import {
  globalNavItems,
  isGlobalNavActive,
} from '../sidebar-global/navigation-global-items'
import { useMobileNav } from './mobile-nav-context'

const MD_QUERY = '(min-width: 48rem)'

/**
 * Phone navigation (below `md`): a menu button in the header that opens a
 * left drawer with the global modules on top and, under them, the current
 * module's `ContextSidebar` content (portaled in by the sidebar itself).
 * Closes on any link click and on route change.
 */
export function MobileNavDrawer({
  slug,
  wikiEnabled = false,
}: {
  slug: string
  wikiEnabled?: boolean
}) {
  const pathname = usePathname()
  const mobileNav = useMobileNav()
  const [open, setOpen] = useState(false)
  const [stickiesOpen, setStickiesOpen] = useState(false)

  // Route changed (link, back button, router.push from inside the drawer).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Growing past `md` shows the rails again; drop the modal so it does not
  // keep the page locked behind an overlay.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(MD_QUERY)
    const onChange = () => {
      if (mq.matches) setOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [open])

  // Same-route links do not change `pathname`, so close on the click itself.
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('a[href]')) setOpen(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant='ghost'
              size='icon-lg'
              aria-label='Abrir menu de navegação'
              className='shrink-0 md:hidden'
            />
          }
        >
          <SteelIcon icon={Menu01Icon} strokeWidth={2} size={20} />
        </SheetTrigger>
        <SheetContent
          side='left'
          showCloseButton={false}
          className='gap-0 data-[side=left]:w-[min(20rem,85vw)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] motion-reduce:animate-none motion-reduce:transition-none'
        >
          <div className='flex items-center justify-between gap-2 border-b border-border px-3 py-2'>
            <SheetTitle className='text-sm font-semibold'>Navegação</SheetTitle>
            <SheetDescription className='sr-only'>
              Módulos do workspace e o menu da área atual.
            </SheetDescription>
            <SheetClose
              render={
                <Button
                  variant='ghost'
                  size='icon-lg'
                  aria-label='Fechar menu'
                />
              }
            >
              <SteelIcon icon={Cancel01Icon} strokeWidth={2} size={20} />
            </SheetClose>
          </div>
          <div
            className='flex-1 overflow-y-auto overscroll-contain p-3'
            onClick={closeOnLink}
          >
            <nav aria-label='Módulos' className='space-y-1'>
              {globalNavItems(slug, { wikiEnabled }).map((item) => {
                const active = isGlobalNavActive(pathname, item.href)
                return (
                  <Fragment key={item.href}>
                    {item.separated && <div className='my-2 h-px bg-border' />}
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        buttonVariants({
                          variant: active ? 'secondary' : 'ghost',
                          size: 'lg',
                        }),
                        'w-full justify-start gap-3',
                        !active && 'text-muted-foreground',
                      )}
                    >
                      <SteelIcon icon={item.icon} className='size-5' />
                      {item.label}
                    </Link>
                  </Fragment>
                )
              })}
              <button
                type='button'
                aria-haspopup='dialog'
                onClick={() => {
                  setOpen(false)
                  setStickiesOpen(true)
                }}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'lg' }),
                  'w-full justify-start gap-3 text-muted-foreground',
                )}
              >
                <SteelIcon icon={StickyNote02Icon} className='size-5' />
                Stickies
              </button>
            </nav>
            <div
              ref={mobileNav?.setContextSlot}
              className='mt-3 border-t border-border pt-3 empty:hidden [&_[data-slot=button]]:min-h-10'
            />
          </div>
        </SheetContent>
      </Sheet>
      <UserStickyDialog open={stickiesOpen} onOpenChange={setStickiesOpen} />
    </>
  )
}
