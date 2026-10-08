import Image from 'next/image'
import Link from 'next/link'
import { ButtonLink } from '@/components/button-link'
import { Muted } from '@/components/typography/text/muted'

interface FooterLink {
  label: string
  href: string
}

interface FooterGroup {
  title: string
  links: FooterLink[]
}

// One entry per grid column; every href is a route Steel actually serves.
const FOOTER_COLUMNS: FooterGroup[][] = [
  [
    {
      title: 'Produto',
      links: [
        { label: 'Marketplace', href: '/marketplace' },
        { label: 'Novidades (Changelog)', href: '/changelog' },
        { label: 'Referência da API', href: '/docs' },
      ],
    },
  ],
  [
    {
      title: 'Planos e preços',
      links: [
        { label: 'Pro', href: '/pricing' },
        { label: 'Business', href: '/pricing' },
        { label: 'Nível empresarial', href: '/pricing' },
      ],
    },
  ],
  [
    {
      title: 'Suporte',
      links: [
        { label: 'Portal de atendimento', href: '/suporte' },
        { label: 'Status', href: '/status' },
        { label: 'Contato geral', href: '/contact' },
      ],
    },
  ],
  [
    {
      title: 'Empresa',
      links: [
        { label: 'Sobre', href: '/about' },
        { label: 'Manifesto', href: '/manifesto' },
        { label: 'Fale com vendas', href: '/talk-to-sales' },
      ],
    },
  ],
  [
    {
      title: 'Jurídico',
      links: [
        { label: 'Termos', href: '/legals/terms' },
        { label: 'Privacidade', href: '/legals/privacy' },
        { label: 'Segurança', href: '/legals/security' },
        { label: 'Subprocessadores', href: '/legals/subprocessors' },
      ],
    },
  ],
  [
    {
      title: 'Acesso',
      links: [
        { label: 'Entrar', href: '/sign-in' },
        { label: 'Criar conta', href: '/sign-up' },
      ],
    },
  ],
]

interface WebFooterProps {
  showBanner?: boolean
}

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
        <div className='w-full mx-auto px-4 py-3 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384 flex flex-col md:flex-row gap-4 justify-between'>
          <Link href='/' className='justify-self-start'>
            <Image
              src='/brand/logo.svg'
              alt='steel-logo'
              width={100}
              height={45}
              className='invert dark:invert-0'
            />
          </Link>
        </div>
        <div className='w-full mx-auto px-4 py-3 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384'>
          <div className='grid w-full grid-cols-2 gap-8 lg:grid-cols-3 xl:grid-cols-6'>
            {FOOTER_COLUMNS.map((groups) => (
              <div
                key={groups[0].title}
                className='cols-span-1 flex flex-col gap-4 pb-6'
              >
                {groups.map((group) => (
                  <div key={group.title} className='mb-4'>
                    <Muted className='font-medium'>{group.title}</Muted>
                    <ul className='mt-1 space-y-2 text-sm'>
                      {group.links.map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            className='md:whitespace-pre-line text-primary text-xs font-medium hover:underline'
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <hr />
        <div className='w-full mx-auto px-4 py-3 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384 flex items-center justify-between gap-6 flex-wrap'>
          <Muted className='text-xs'>
            Steel, uma plataforma Stratus Telecom.
          </Muted>
        </div>
      </footer>
    </div>
  )
}
