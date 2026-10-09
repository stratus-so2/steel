import Image from 'next/image'
import Link from 'next/link'
import { ButtonLink } from '@/components/button-link'
import { Muted } from '@/components/typography/text/muted'
import { FooterStatus } from './footer-status'
import { type WebNavLink, webNav } from './header/web-header-nav-data'

export interface FooterGroup {
  title: string
  links: WebNavLink[]
}

const toLink = ({ label, href }: WebNavLink): WebNavLink => ({ label, href })

/**
 * One entry per grid column. Product and feature links come from the shared
 * nav config; everything else is a route Steel serves today.
 */
export const FOOTER_GROUPS: FooterGroup[] = [
  { title: 'Produto', links: webNav.product.map(toLink) },
  { title: 'Recursos', links: webNav.features.map(toLink) },
  {
    title: 'Plataforma',
    links: [
      { label: 'Preços', href: '/pricing' },
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Novidades (Changelog)', href: '/changelog' },
      { label: 'Documentação', href: '/docs' },
      { label: 'Desenvolvedores', href: '/dev' },
    ],
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Portal de atendimento', href: '/suporte' },
      { label: 'Status', href: '/status' },
      { label: 'Contato geral', href: '/contact' },
      { label: 'Fale com vendas', href: '/talk-to-sales' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre', href: '/about' },
      { label: 'Manifesto', href: '/manifesto' },
      { label: 'Entrar', href: '/sign-in' },
      { label: 'Criar conta', href: '/sign-up' },
    ],
  },
  {
    title: 'Jurídico',
    links: [
      { label: 'Termos', href: '/legals/terms' },
      { label: 'Privacidade', href: '/legals/privacy' },
      { label: 'Segurança', href: '/legals/security' },
      { label: 'Subprocessadores', href: '/legals/subprocessors' },
    ],
  },
]

interface WebFooterProps {
  showBanner?: boolean
}

/**
 * Public site footer, Nexo's layout: optional closing banner, then logo and
 * live status on top, the link grid, and a bottom bar with the copyright.
 */
export function WebFooter({ showBanner = true }: WebFooterProps = {}) {
  return (
    <div className='w-full'>
      {showBanner && (
        <div className="hidden md:block w-full py-20 bg-cover bg-center bg-no-repeat bg-[url('/gradient.png')]">
          <div className='mx-auto w-full px-4 sm:px-8 xl:px-11 xl:max-w-336 2xl:max-w-384 flex flex-col space-y-10 items-center text-center'>
            <h2 className='text-5xl font-normal md:whitespace-pre-line font-mono leading-[1.3] tracking-[-.03em] text-white'>
              Atendimento, vendas e conversas <br /> num workspace só
            </h2>
            <div className='flex flex-wrap w-full items-center gap-4 justify-center'>
              <ButtonLink
                href='/talk-to-sales'
                variant='secondary'
                size='lg'
                className='border-border'
              >
                Fale com um especialista
              </ButtonLink>
              <ButtonLink href='/sign-up' size='lg'>
                Comece grátis
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
      <footer className='w-full bg-surface-highlight space-y-10 py-16'>
        <div className='w-full mx-auto px-4 py-3 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384 flex flex-col md:flex-row md:items-center gap-4 justify-between'>
          <Link href='/' className='justify-self-start' aria-label='Steel'>
            <Image
              src='/brand/logo.svg'
              alt='Steel'
              width={100}
              height={45}
              className='invert dark:invert-0'
            />
          </Link>
          <FooterStatus />
        </div>
        <nav
          aria-label='Rodapé'
          className='w-full mx-auto px-4 py-3 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384'
        >
          <div className='grid w-full grid-cols-2 gap-8 lg:grid-cols-3 xl:grid-cols-6'>
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title} className='flex flex-col gap-4 pb-6'>
                <div className='mb-4'>
                  <Muted className='font-medium'>{group.title}</Muted>
                  <ul className='mt-1 space-y-2 text-sm'>
                    {group.links.map((link) => (
                      <li key={`${link.href}-${link.label}`}>
                        <Link
                          href={link.href}
                          className='text-primary text-xs font-medium hover:underline'
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </nav>
        <hr />
        <div className='w-full mx-auto px-4 py-3 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384 flex items-center justify-between gap-6 flex-wrap'>
          <Muted className='text-xs'>
            © Stratus Telecom. Steel, uma plataforma Stratus Telecom.
          </Muted>
        </div>
      </footer>
    </div>
  )
}
