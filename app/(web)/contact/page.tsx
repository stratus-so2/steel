import {
  ActivityIcon,
  BookOpenTextIcon,
  Call02Icon,
  CircleQuestionMarkIcon,
  CodeSquareIcon,
  Mail02Icon,
} from '@hugeicons-pro/core-solid-rounded'
import type { Metadata } from 'next'
import { ButtonLink } from '@/components/button-link'
import { SteelIcon } from '@/components/icon/icon'
import { WebFooter } from '../_components/footer'
import { SubTitle } from '../_components/text/sub-title'
import { Title } from '../_components/text/title'

type IconType = Parameters<typeof SteelIcon>[0]['icon']

const TITLE = 'Contato | Steel'
const DESCRIPTION =
  'Vendas, suporte, documentação e outros canais de contato do Steel.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    url: '/contact',
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

interface ContactCard {
  title: string
  description: string
  cta: string
  href: string
  icon: IconType
}

const CONTACT_CARDS: ContactCard[] = [
  {
    title: 'Vendas',
    description:
      'Fale com a gente sobre planos, implantação e como trazer seus dados de outra ferramenta.',
    cta: 'Falar com vendas',
    href: '/talk-to-sales',
    icon: Call02Icon,
  },
  {
    title: 'Ajuda e suporte',
    description:
      'Abra e acompanhe seus chamados pelo portal de atendimento, ou escreva para suporte@stratustelecom.com.br.',
    cta: 'Abrir um chamado',
    href: '/suporte',
    icon: CircleQuestionMarkIcon,
  },
  {
    title: 'Status',
    description:
      'Veja em tempo real se o Steel está operando normalmente e o histórico de incidentes.',
    cta: 'Ver o status',
    href: '/status',
    icon: ActivityIcon,
  },
  {
    title: 'Documentação',
    description:
      'Referência dos recursos e endpoints do Steel, do primeiro setup às integrações.',
    cta: 'Ler a documentação',
    href: '/docs',
    icon: BookOpenTextIcon,
  },
  {
    title: 'Desenvolvedores',
    description:
      'Explore a referência da nossa API REST pra construir integrações com o Steel.',
    cta: 'Ver a API',
    href: '/dev',
    icon: CodeSquareIcon,
  },
  {
    title: 'Outros assuntos',
    description:
      'Parcerias, imprensa ou qualquer outro assunto — é só mandar um e-mail.',
    cta: 'Enviar e-mail',
    href: 'mailto:contato@stratustelecom.com.br',
    icon: Mail02Icon,
  },
]

export default function ContactPage() {
  return (
    <>
      <main className='w-full flex flex-col items-center flex-1 mx-auto'>
        <div className='text-center mx-auto w-full xl:max-w-336 xl:px-11 2xl:max-w-384 py-16 space-y-12 px-4 sm:px-8'>
          <div className='space-y-4'>
            <Title>Como podemos ajudar?</Title>
            <SubTitle>
              De dúvidas técnicas a parcerias, é só escolher o canal certo
              abaixo.
            </SubTitle>
          </div>
          <div className='grid grid-cols-1 gap-6 text-start sm:grid-cols-2 lg:grid-cols-3'>
            {CONTACT_CARDS.map((card) => (
              <div
                key={card.title}
                className='border border-border flex flex-col justify-between gap-16 rounded-xl p-6 transition bg-card'
              >
                <div className='flex size-10 items-center justify-center rounded-md border border-border'>
                  <SteelIcon icon={card.icon} size={24} />
                </div>
                <div className='space-y-6'>
                  <div className='space-y-2'>
                    <h3 className='font-medium text-lg md:whitespace-pre-line'>
                      {card.title}
                    </h3>
                    <p className='text-base text-muted-foreground'>
                      {card.description}
                    </p>
                  </div>
                  <ButtonLink href={card.href} size='lg'>
                    {card.cta}
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <WebFooter showBanner={false} />
    </>
  )
}
