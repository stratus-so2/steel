import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Muted } from '@/components/typography/text/muted'
import { TalkToSalesForm } from './talk-to-sales-form'

const TITLE = 'Falar com vendas | Steel'
const DESCRIPTION =
  'Converse com nosso time sobre planos, implantação e migração para o Steel.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/talk-to-sales' },
  openGraph: {
    type: 'website',
    url: '/talk-to-sales',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/twitter-image'],
  },
}

export default function TalkToSalesPage() {
  return (
    <main className='relative flex overflow-hidden lg:h-[calc(100dvh-72px)]'>
      <div className='pointer-events-none absolute inset-y-0 left-0 z-0 hidden w-1/2 lg:block'>
        <Image
          src='/gradient.png'
          alt=''
          aria-hidden
          fill
          priority
          quality={100}
          unoptimized
          sizes='(min-width: 1024px) 50vw, 100vw'
          className='object-cover object-center'
        />
      </div>
      <div className='relative z-10 flex w-full flex-col gap-6 px-4 py-8 sm:px-8 lg:h-full lg:flex-row lg:gap-0 lg:py-11 xl:mx-46 xl:px-0'>
        <div className='flex-1 flex items-center justify-center lg:p-10'>
          <div className='w-full max-w-xl bg-card rounded-2xl border border-border p-6 sm:p-10 flex flex-col gap-10 sm:gap-16'>
            <div className='flex flex-col gap-3'>
              <h2 className='text-4xl'>Fale com um humano</h2>
              <Muted>
                Obtenha preços, passe por uma demonstração ao vivo, planeje a
                migração da sua equipe ou o uso do seu próprio banco de dados.
              </Muted>
            </div>
            <div>
              <Muted>
                ServiceDesk, CRM e WhatsApp Business num workspace só, feito
                pela Stratus Telecom.
              </Muted>
            </div>
            <Muted className='text-xs'>
              Suporte técnico ou de produto:{' '}
              <Link href='mailto:suporte@steel.stratustelecom.com.br'>
                <strong className='text-primary'>
                  suporte@steel.stratustelecom.com.br
                </strong>
              </Link>{' '}
              ou veja os{' '}
              <Link href='/docs'>
                <strong className='text-primary'>documentos</strong>
              </Link>
              .
            </Muted>
          </div>
        </div>
        <div className='flex-1 flex items-center justify-center lg:p-10'>
          <TalkToSalesForm />
        </div>
      </div>
    </main>
  )
}
