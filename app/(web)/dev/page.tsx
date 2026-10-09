import { ApiIcon, ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { publicPageMetadata } from '@/src/lib/seo/metadata'

export const metadata: Metadata = publicPageMetadata({
  title: 'Desenvolvedores | Steel',
  description:
    'Documentação para quem integra outros sistemas ao Steel: a API REST e a sua referência completa.',
  path: '/dev',
})

export default function DevIndexPage() {
  return (
    <main className='flex flex-col gap-10 py-10 lg:py-16 lg:pr-8'>
      <header className='flex max-w-3xl flex-col gap-4'>
        <span className='text-sm text-muted-foreground'>Desenvolvedores</span>
        <h1 className='text-4xl font-normal sm:text-5xl'>
          Integre seus sistemas ao Steel
        </h1>
        <p className='text-lg text-muted-foreground'>
          O Steel expõe uma API REST para ler e gravar os dados do workspace a
          partir de outros sistemas: chamados do ServiceDesk, registros do CRM,
          conversas da Comunicação e mais. A referência lista cada rota, os
          parâmetros, as respostas e os códigos de erro.
        </p>
      </header>
      <Link
        href='/dev/api'
        className='flex max-w-3xl items-center justify-between gap-4 rounded-xl border border-border p-5 transition-colors hover:bg-card'
      >
        <span className='flex gap-3'>
          <SteelIcon icon={ApiIcon} size={24} className='mt-0.5 shrink-0' />
          <span className='flex flex-col gap-1'>
            <span className='text-lg font-medium'>Referência da API</span>
            <span className='text-sm text-muted-foreground'>
              Rotas, parâmetros, respostas e erros, gerados a partir do código.
            </span>
          </span>
        </span>
        <SteelIcon icon={ArrowRight01Icon} size={18} className='shrink-0' />
      </Link>
      <p className='max-w-3xl text-sm text-muted-foreground'>
        Procurando como usar o Steel no dia a dia? Veja o{' '}
        <Link href='/docs' className='text-primary underline'>
          manual do usuário
        </Link>
        .
      </p>
    </main>
  )
}
