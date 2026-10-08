import type { Metadata } from 'next'
import { WebFooter } from '../_components/footer'
import { SubTitle } from '../_components/text/sub-title'
import { Title } from '../_components/text/title'
import { ManifestoHeroImage } from './manifesto-hero-image'
import { ManifestoPrinciples } from './manifesto-principles'

const TITLE = 'Manifesto | Steel'
const DESCRIPTION =
  'Os princípios de produto e engenharia que guiam como construímos o Steel.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/manifesto' },
  openGraph: {
    type: 'website',
    url: '/manifesto',
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

export default function ManifestoPage() {
  return (
    <>
      <main className='min-h-dvh w-full flex flex-col items-center flex-1 mx-auto'>
        <section className='min-h-[60vh] mx-auto w-full xl:max-w-336 xl:px-11 2xl:max-w-384 pt-11 md:pt-9 border-r border-l border-border'>
          <div className='flex flex-col items-center text-center gap-10'>
            <div className='flex flex-col items-center'>
              <div className='mb-4 bg-card rounded-full border border-border px-3 py-1.5 w-fit text-muted-foreground text-xs uppercase whitespace-nowrap font-medium'>
                um manifesto pra quem atende, vende e conversa
              </div>
              <div className='space-y-6 max-w-2xl'>
                <Title>Uma operação que você enxerga inteira</Title>
                <SubTitle>
                  Princípios de produto e engenharia que guiam como construímos
                  o Steel.
                </SubTitle>
              </div>
              <p className='mt-12 max-w-2xl rounded-xl border border-border px-6 py-5 text-center bg-surface-highlight text-lg text-muted-foreground'>
                <strong className='font-semibold text-primary'>
                  O Steel é um sistema de registro único pro atendimento, o
                  relacionamento e as conversas com o cliente.
                </strong>{' '}
                Chamado, oportunidade e mensagem moram no mesmo workspace, então
                o time muda processo, fila e funil sem migração, sem retrabalho
                e sem perder o histórico.{' '}
                <strong className='font-semibold text-primary'>
                  O controle sobre a operação continua com o time.
                </strong>
              </p>
            </div>
            <ManifestoHeroImage />
          </div>
        </section>
        <div className='w-full border-y border-border h-20 overflow-hidden'>
          <div className='mx-auto w-full h-full xl:max-w-336 xl:px-11 2xl:max-w-384 border-r border-l border-border bg-[repeating-linear-gradient(90deg,var(--color-border)_0px,var(--color-border)_1px,transparent_1px,transparent_16px)] overflow-hidden' />
        </div>
        <ManifestoPrinciples />
        <div className='w-full border-y border-border h-20 overflow-hidden'>
          <div className='mx-auto w-full h-full xl:max-w-336 xl:px-11 2xl:max-w-384 border-r border-l border-border bg-[repeating-linear-gradient(90deg,var(--color-border)_0px,var(--color-border)_1px,transparent_1px,transparent_16px)] overflow-hidden' />
        </div>
      </main>
      <WebFooter showBanner={false} />
    </>
  )
}
