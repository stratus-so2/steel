import type { IconSvgElement } from '@hugeicons/react'
import { ArrowRight02Icon } from '@hugeicons-pro/core-solid-rounded'
import Link from 'next/link'
import type { ComponentPropsWithoutRef } from 'react'
import { ButtonLink } from '@/components/button-link'
import { SteelIcon } from '@/components/icon/icon'
import { Muted } from '@/components/typography/text/muted'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import {
  NavigationMenuContent,
  NavigationMenuLink,
} from '@/components/ui/navigation-menu'
import { webNav } from './web-header-nav-data'

export interface LatestRelease {
  title: string
  slug: string
  /** Already formatted for display (pt-BR). */
  date: string
}

/**
 * The "Produto" mega-menu, laid out like Nexo's: modules, feature pages, a
 * call-to-action card and, under them, a strip with the latest release.
 */
export function WebHeaderProductMenu({
  latest,
}: {
  latest: LatestRelease | null
}) {
  return (
    <NavigationMenuContent className='w-screen py-8'>
      <div className='mx-auto w-full space-y-8 px-4 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384'>
        <div className='grid grid-cols-4 items-start gap-8'>
          <div className='flex flex-col gap-1.5'>
            <Muted className='px-2'>Produtos</Muted>
            <ul className='grid grid-cols-1 gap-4'>
              {webNav.product.map((item) => (
                <ListItem
                  key={item.href}
                  title={item.label}
                  href={item.href}
                  icon={item.icon}
                >
                  {item.description}
                </ListItem>
              ))}
            </ul>
          </div>
          <div className='col-span-2 flex flex-col gap-1.5'>
            <Muted className='px-2'>Capacidades de Recursos</Muted>
            <ul className='grid grid-cols-2 gap-4'>
              {webNav.features.map((item) => (
                <ListItem
                  key={item.href}
                  title={item.label}
                  href={item.href}
                  icon={item.icon}
                >
                  {item.description}
                </ListItem>
              ))}
            </ul>
          </div>
          <Card className='h-full border border-brand-500 bg-muted'>
            <CardContent className='flex flex-1 flex-col'>
              <CardTitle>Veja o Steel com os seus processos</CardTitle>
              <CardDescription className='mt-1.5'>
                Mostramos o ServiceDesk, o CRM e o WhatsApp rodando com as
                filas, os funis e os SLAs do seu time.
              </CardDescription>
              <div className='mt-auto pt-4'>
                <ButtonLink
                  href={webNav.cta.href}
                  variant='link'
                  size='sm'
                  className='p-0'
                >
                  Agendar uma demonstração
                  <SteelIcon icon={ArrowRight02Icon} size={20} />
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        </div>
        {latest && (
          <div className='flex items-center justify-between gap-4 rounded-md bg-muted/75 p-2.5'>
            <div className='flex min-w-0 items-center gap-2'>
              <p className='truncate text-sm'>
                Novidade: {latest.title} | {latest.date}
              </p>
              <ButtonLink
                href={`/changelog/${latest.slug}`}
                variant='link'
                size='sm'
              >
                Saiba mais <SteelIcon icon={ArrowRight02Icon} size={20} />
              </ButtonLink>
            </div>
            <ButtonLink href='/changelog' variant='link' size='sm'>
              Ver o changelog
            </ButtonLink>
          </div>
        )}
      </div>
    </NavigationMenuContent>
  )
}

function ListItem({
  title,
  children,
  href,
  icon,
  ...props
}: ComponentPropsWithoutRef<'li'> & {
  href: string
  icon?: IconSvgElement
}) {
  return (
    <li className='h-full' {...props}>
      <NavigationMenuLink
        className='h-full items-start'
        render={
          <Link href={href}>
            <div className='flex w-full flex-col gap-1 text-sm hover:text-branding-700 hover:dark:text-branding-400'>
              <div className='flex items-center gap-1.5'>
                {icon && <SteelIcon icon={icon} size={20} />}
                <div className='leading-none font-medium'>{title}</div>
              </div>
              <div className='line-clamp-2 text-muted-foreground'>
                {children}
              </div>
            </div>
          </Link>
        }
      />
    </li>
  )
}
