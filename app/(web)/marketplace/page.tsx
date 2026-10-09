import type { Metadata } from 'next'
import { ButtonLink } from '@/components/button-link'
import { SteelIcon } from '@/components/icon/icon'
import { publicPageMetadata } from '@/src/lib/seo/metadata'
import { SubTitle } from '../_components/text/sub-title'
import { Title } from '../_components/text/title'
import { MARKETPLACE_GROUPS } from './marketplace-data'

export const metadata: Metadata = publicPageMetadata({
  title: 'Marketplace de integrações | Steel',
  description:
    'WhatsApp, Slack, GitHub, GitLab, Zabbix, OpenAI, Anthropic, Gmail, Outlook e outras integrações que já funcionam no Steel.',
  path: '/marketplace',
})

/** Same layout and card as /contact, one grid per group of integrations. */
export default function MarketplacePage() {
  return (
    <main className='w-full flex flex-col items-center flex-1 mx-auto'>
      <div className='text-center mx-auto w-full xl:max-w-336 xl:px-11 2xl:max-w-384 py-16 space-y-12 px-4 sm:px-8'>
        <div className='space-y-4'>
          <Title className='text-4xl sm:text-6xl'>
            Conecte o Steel ao que você já usa
          </Title>
          <SubTitle>
            As integrações que já funcionam hoje, de WhatsApp e Slack a GitHub,
            Zabbix e os modelos de IA. Sem plugin para instalar.
          </SubTitle>
        </div>
        {MARKETPLACE_GROUPS.map((group, index) => (
          <section
            key={group.title}
            aria-labelledby={`marketplace-group-${index}`}
            className='space-y-6 text-start'
          >
            <h2
              id={`marketplace-group-${index}`}
              className='font-medium text-xl'
            >
              {group.title}
            </h2>
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {group.integrations.map((integration) => (
                <div
                  key={integration.title}
                  className='border border-border flex flex-col justify-between gap-16 rounded-xl p-6 transition bg-card'
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex size-10 shrink-0 items-center justify-center rounded-md border border-border'>
                      <SteelIcon icon={integration.icon} size={24} />
                    </div>
                    <span className='text-xs text-muted-foreground text-end'>
                      {integration.module}
                    </span>
                  </div>
                  <div className='space-y-6'>
                    <div className='space-y-2'>
                      <h3 className='font-medium text-lg'>
                        {integration.title}
                      </h3>
                      <p className='text-base text-muted-foreground'>
                        {integration.description}
                      </p>
                    </div>
                    <ButtonLink href={integration.href} size='lg'>
                      {integration.cta}
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <div className='space-y-4 pt-4'>
          <SubTitle>
            Precisa de uma integração que não está aqui? Conte para a gente.
          </SubTitle>
          <ButtonLink href='/talk-to-sales' size='lg' variant='outline'>
            Fale com vendas
          </ButtonLink>
        </div>
      </div>
    </main>
  )
}
