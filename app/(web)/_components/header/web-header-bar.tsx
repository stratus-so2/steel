'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ButtonLink } from '@/components/button-link'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { cn } from '@/lib/utils'
import { WebHeaderMobileMenu } from './web-header-mobile-menu'
import { isProductActive, isWebNavActive, webNav } from './web-header-nav-data'
import {
  type LatestRelease,
  WebHeaderProductMenu,
} from './web-header-product-menu'

/**
 * The public site's top bar (Nexo's web header): sticky, full width and
 * borderless at the top of the page; once the page scrolls it narrows to the
 * content width on wide screens and gets rounded bottom corners. Below `md`
 * the links collapse into `WebHeaderMobileMenu`.
 */
export function WebHeaderBar({ latest }: { latest: LatestRelease | null }) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        'sticky top-0 z-50 mx-auto grid h-16 w-full grid-cols-[1fr_auto] items-center border-2 border-t-0 border-border border-x-transparent bg-background px-4 transition-[max-width,border-radius,border-color] duration-300 ease-out sm:px-8 md:h-[72px] md:grid-cols-[1fr_auto_1fr] xl:px-11',
        scrolled
          ? 'xl:max-w-336 xl:rounded-b-2xl xl:border-x-border 2xl:max-w-384'
          : 'max-w-full rounded-none',
      )}
    >
      <Link href='/' className='justify-self-start' aria-label='Steel, início'>
        <Image
          src='/brand/logo.svg'
          alt='Steel'
          width={100}
          height={45}
          priority
          className='invert dark:invert-0'
        />
      </Link>
      <NavigationMenu aria-label='Principal' className='hidden flex-1 md:flex'>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger
              data-active={isProductActive(pathname) || undefined}
              className='data-active:bg-muted/50'
            >
              Produto
            </NavigationMenuTrigger>
            <WebHeaderProductMenu latest={latest} />
          </NavigationMenuItem>
          {webNav.main.map((link) => {
            const active = isWebNavActive(pathname, link.href)
            return (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink
                  active={active}
                  aria-current={active ? 'page' : undefined}
                  className={navigationMenuTriggerStyle()}
                  render={<Link href={link.href}>{link.label}</Link>}
                />
              </NavigationMenuItem>
            )
          })}
        </NavigationMenuList>
      </NavigationMenu>
      <div className='flex items-center gap-1.5 justify-self-end'>
        <ButtonLink
          href={webNav.signIn.href}
          variant='ghost'
          size='sm'
          className='hidden md:inline-flex'
        >
          {webNav.signIn.label}
        </ButtonLink>
        <ButtonLink
          href={webNav.cta.href}
          size='sm'
          className='hidden sm:inline-flex'
        >
          {webNav.cta.label}
        </ButtonLink>
        <WebHeaderMobileMenu />
      </div>
    </header>
  )
}
