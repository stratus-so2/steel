'use client'

import { Cancel01Icon, Menu01Icon } from '@hugeicons-pro/core-stroke-rounded'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type MouseEvent, useEffect, useState } from 'react'
import { ButtonLink } from '@/components/button-link'
import { SteelIcon } from '@/components/icon/icon'
import { Muted } from '@/components/typography/text/muted'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { isWebNavActive, webNav } from './web-header-nav-data'

const MD_QUERY = '(min-width: 48rem)'

/**
 * Phone menu of the public site (below `md`): a button in the header that
 * drops a full-width sheet from the top with the modules, the main links, the
 * sign-in link and the primary call to action. Closes on any link click, on
 * route change and when the viewport grows past `md`.
 */
export function WebHeaderMobileMenu() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Route changed (link, back button): close the menu.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant='ghost'
            size='icon-lg'
            aria-label='Abrir menu'
            className='md:hidden'
          />
        }
      >
        <SteelIcon icon={Menu01Icon} strokeWidth={2} size={20} />
      </SheetTrigger>
      <SheetContent
        side='top'
        showCloseButton={false}
        className='max-h-dvh gap-0 overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] motion-reduce:animate-none motion-reduce:transition-none'
      >
        <div className='flex h-16 items-center justify-between border-b border-border px-4 sm:px-8'>
          <SheetTitle className='sr-only'>Menu</SheetTitle>
          <SheetDescription className='sr-only'>
            Produtos, páginas do site e acesso à conta.
          </SheetDescription>
          <Image
            src='/brand/logo.svg'
            alt='Steel'
            width={100}
            height={45}
            className='invert dark:invert-0'
          />
          <SheetClose
            render={
              <Button variant='ghost' size='icon-lg' aria-label='Fechar menu' />
            }
          >
            <SteelIcon icon={Cancel01Icon} strokeWidth={2} size={20} />
          </SheetClose>
        </div>
        <div className='space-y-6 px-4 py-5 sm:px-8' onClick={closeOnLink}>
          <nav aria-label='Produto' className='space-y-1'>
            <Muted className='px-2 text-xs'>Produto</Muted>
            <ul>
              {webNav.product.map((item) => {
                const active = isWebNavActive(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-start gap-3 rounded-md p-2 hover:bg-muted',
                        active && 'bg-muted',
                      )}
                    >
                      <SteelIcon icon={item.icon} size={20} />
                      <span className='flex flex-col gap-0.5'>
                        <span className='text-sm font-medium leading-none'>
                          {item.label}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <nav aria-label='Principal' className='border-t border-border pt-4'>
            <ul className='space-y-1'>
              {webNav.main.map((link) => {
                const active = isWebNavActive(pathname, link.href)
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'block rounded-md p-2 text-base font-medium hover:bg-muted',
                        active && 'bg-muted',
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className='grid gap-2 border-t border-border pt-4'>
            <ButtonLink href={webNav.signIn.href} variant='outline' size='lg'>
              {webNav.signIn.label}
            </ButtonLink>
            <ButtonLink href={webNav.cta.href} size='lg'>
              {webNav.cta.label}
            </ButtonLink>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
