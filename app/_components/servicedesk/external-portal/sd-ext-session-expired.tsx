'use client'

import { MailOpen01Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'

/**
 * Sessão do portal vencida ou revogada: o contato não tem senha, então o
 * único caminho é pedir outro link. Nada de "faça login".
 */
export function SdExtSessionExpired({ message }: { message?: string }) {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-muted p-6 text-center'>
      <div className='grid size-12 place-items-center rounded-2xl border bg-card text-muted-foreground'>
        <SteelIcon icon={MailOpen01Icon} strokeWidth={1.8} className='size-6' />
      </div>
      <div className='space-y-1'>
        <h1 className='font-semibold text-lg'>Seu acesso expirou</h1>
        <p className='mx-auto max-w-sm text-muted-foreground text-sm'>
          {message ??
            'Por segurança, o acesso ao portal vale 12 horas. Peça um link novo — ele chega no seu e-mail em instantes.'}
        </p>
      </div>
      <Link href='/suporte' className={buttonVariants({ size: 'lg' })}>
        Pedir um novo acesso
      </Link>
    </div>
  )
}
