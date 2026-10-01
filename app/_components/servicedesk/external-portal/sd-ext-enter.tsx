'use client'

import { Alert02Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useOpenSdPortalSession } from '@/src/hooks/use-sd-external-portal'

/**
 * `/suporte/entrar/[token]`: troca o token do link mágico pela sessão de 12
 * horas e segue para os chamados. O consumo é um **POST** disparado aqui,
 * não no GET da página: assim o pré-carregador do cliente de e-mail não
 * queima o link do contato antes dele clicar.
 */
export function SdExtEnter({ token }: { token: string }) {
  const router = useRouter()
  const open = useOpenSdPortalSession()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true
    open
      .mutateAsync(token)
      .then(() => router.replace('/suporte/chamados'))
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não conseguimos abrir o portal com este link',
        )
      })
  }, [token, router, open])

  if (error) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 p-6 text-center'>
        <div className='flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300'>
          <SteelIcon icon={Alert02Icon} strokeWidth={1.8} className='size-6' />
        </div>
        <div className='space-y-1'>
          <h1 className='font-semibold text-lg'>Este link não vale mais</h1>
          <p className='mx-auto max-w-sm text-muted-foreground text-sm'>
            {error}
          </p>
        </div>
        <Link href='/suporte' className={buttonVariants({ size: 'lg' })}>
          Pedir um novo acesso
        </Link>
      </div>
    )
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/30 p-6'>
      <p className='text-muted-foreground text-sm'>Abrindo seu portal…</p>
      <Skeleton className='h-10 w-64 rounded-xl' />
    </div>
  )
}
