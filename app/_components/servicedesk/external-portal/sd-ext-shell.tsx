'use client'

import {
  BookOpen01Icon,
  CustomerService01Icon,
  Logout03Icon,
  Ticket01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useCloseSdPortalSession,
  useSdPortalSession,
} from '@/src/hooks/use-sd-external-portal'
import { SdExtSessionExpired } from './sd-ext-session-expired'

const NAV = [
  { href: '/suporte/chamados', label: 'Meus chamados', icon: Ticket01Icon },
  { href: '/suporte/ajuda', label: 'Ajuda', icon: BookOpen01Icon },
] as const

/**
 * Casca das telas do portal do contato externo: topo com o nome do
 * workspace que atende, as duas abas e o "sair". Sem nenhum chrome do app —
 * quem está aqui é cliente, não usuário do Steel.
 *
 * A sessão é resolvida no cliente: expirada, a tela toda vira o convite a
 * pedir outro link, em vez de mostrar conteúdo vazio.
 */
export function SdExtShell({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const session = useSdPortalSession()
  const signOut = useCloseSdPortalSession()

  if (session.isError) return <SdExtSessionExpired />

  const workspaceName = session.data?.workspace.name ?? ''
  const contactName = session.data?.contact.name ?? ''

  async function leave() {
    await signOut.mutateAsync().catch(() => undefined)
    router.replace('/suporte')
  }

  return (
    <div className='flex min-h-screen flex-col bg-background'>
      <header className='border-border border-b bg-card'>
        <div className='mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 sm:px-6'>
          <div className='flex items-center gap-3'>
            <div className='grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'>
              <SteelIcon
                icon={CustomerService01Icon}
                strokeWidth={1.8}
                className='size-5'
              />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate font-semibold text-sm'>
                {workspaceName || 'Portal de atendimento'}
              </p>
              <p className='truncate text-muted-foreground text-xs'>
                {contactName
                  ? `Atendimento para ${contactName}`
                  : 'Portal de atendimento'}
              </p>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => void leave()}
              disabled={signOut.isPending}
            >
              <SteelIcon icon={Logout03Icon} strokeWidth={2} />
              Sair
            </Button>
          </div>
          <nav className='flex items-center gap-1' aria-label='Portal'>
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-sm transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <SteelIcon
                    icon={item.icon}
                    strokeWidth={2}
                    className='size-4'
                  />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className='mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6'>
        {title ? <h1 className='mb-4 font-semibold text-lg'>{title}</h1> : null}
        {children}
      </main>

      <footer className='border-border border-t bg-card py-4 text-center text-muted-foreground text-xs'>
        Atendimento de {workspaceName || 'sua empresa'} · suporte por link de
        acesso, sem senha
      </footer>
    </div>
  )
}
