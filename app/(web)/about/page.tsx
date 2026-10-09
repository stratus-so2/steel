import type { Metadata } from 'next'
import Image from 'next/image'

const TITLE = 'Sobre | Steel'
const DESCRIPTION =
  'Por que a Stratus Telecom construiu o Steel e pra quem ele é feito.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website',
    url: '/about',
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

export default function AboutPage() {
  return (
    <main className='min-h-dvh w-full flex flex-col items-center flex-1 mx-auto'>
      <div className='flex flex-col items-center text-start mx-auto w-full px-4 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384 py-16 gap-12'>
        <section className='grid grid-cols-1 items-center gap-20 md:grid-cols-2'>
          <div className='space-y-2'>
            <h3 className='font-normal text-2xl md:whitespace-pre-line'>
              O Steel existe pra que atendimento, relacionamento e conversa com
              o cliente aconteçam num workspace só.
            </h3>
            <p className='text-base text-muted-foreground'>
              Service desk, CRM e WhatsApp costumam viver em ferramentas
              separadas — cada uma com sua própria aba, seu próprio login, sua
              própria versão do cliente.
              <br />
              Reunimos os três num único lugar, pra que o chamado, a
              oportunidade e a conversa falem a mesma língua dentro do seu
              workspace.
              <br />
              Não é sobre ter mais uma ferramenta. É sobre ter uma só que
              enxerga o cliente inteiro.
            </p>
          </div>
          <Image
            src='/web/about/about-image-1.svg'
            alt=''
            width={1920}
            height={1920}
            className='w-full'
          />
        </section>
        <section className='grid grid-cols-1 items-center gap-20 md:grid-cols-2'>
          <div className='space-y-2'>
            <h3 className='font-normal text-2xl md:whitespace-pre-line'>
              O Steel é a plataforma que a gente queria ter usado na operação.
            </h3>
            <p className='text-base text-muted-foreground'>
              O Steel nasceu dentro da Stratus Telecom, de quem vive o dia a dia
              de atender cliente, cumprir SLA e fechar venda ao mesmo tempo.
              <br />
              Você provavelmente já tentou ferramentas de ITSM tão pesadas que
              viraram um projeto à parte, ou CRMs e inboxes que nunca
              conversaram com o suporte.
              <br />
              Construímos o Steel pro meio do caminho: as práticas do ITIL 4, o
              funil comercial e o atendimento no WhatsApp no mesmo lugar, sem
              exigir que o seu time vire especialista na ferramenta.
            </p>
          </div>
          <Image
            src='/web/about/about-image-2.svg'
            alt=''
            width={1920}
            height={1920}
            className='w-full'
          />
        </section>
        <section className='grid grid-cols-1 items-center gap-20 md:grid-cols-2'>
          <div className='space-y-2'>
            <h3 className='font-normal text-2xl md:whitespace-pre-line'>
              O caminho até aqui, e o que vem a seguir
            </h3>
            <p className='text-base text-muted-foreground'>
              O Steel começou em 2026, a partir de uma base própria de
              workspaces, autenticação e cobrança.
              <br />
              Hoje ele já tem um ServiceDesk completo — incidentes, requisições,
              mudanças e problemas, SLA sobre calendário útil, CMDB, base de
              conhecimento com KCS, portal do solicitante e painéis em modo TV
              —, um CRM com leads, pipelines, propostas, forecast e campanhas, e
              o atendimento no WhatsApp pela API oficial da Meta ou pela Z-API.
              <br />O Steel AI amarra tudo: responde sobre o workspace e executa
              ações, sempre pedindo confirmação antes de mudar qualquer coisa.
              <br />O que vem a seguir é continuar construindo junto das equipes
              que já usam o Steel — e deixar a IA cada vez mais parte da
              operação, não só um recurso a mais.
            </p>
          </div>
          <Image
            src='/web/about/about-image-3.svg'
            alt=''
            width={1920}
            height={1920}
            className='w-full'
          />
        </section>
        <section />
      </div>
    </main>
  )
}
