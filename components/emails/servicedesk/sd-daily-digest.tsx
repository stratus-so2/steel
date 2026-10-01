import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'
import { baseEmailUrl } from '@/lib/base-email-url'
import { EmailFooter } from '../_components/email-footer'

export interface SdDailyDigestEmailProps {
  email: string
  username?: string
  workspaceName: string
  /** Chamados abertos na mão do agente. */
  queue: number
  /** Desses, quantos estão vencidos ou perto de vencer. */
  atRisk: number
  /** Desses, quantos aguardam resposta de terceiros. */
  waiting: number
  /** Até cinco chamados para abrir direto. */
  highlights: { code: string; title: string; url: string }[]
  redirectUrl: string
}

/** Resumo diário do ServiceDesk (opt-in, uma vez por dia). */
export const SdDailyDigest = ({
  username,
  workspaceName,
  queue,
  atRisk,
  waiting,
  highlights,
  redirectUrl,
}: SdDailyDigestEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>
          {`Steel | ${queue} chamado(s) na sua fila, ${atRisk} com prazo apertado`}
        </Preview>
        <Container className='bg-white mx-auto py-10 px-6 max-w-140'>
          <Img
            width={120}
            height={33.8}
            className='mb-10'
            src={`${baseEmailUrl}/brand/logo-email.png`}
            alt='Steel'
          />
          <Section>
            <Text className='text-2xl leading-6.5'>
              <strong>Seu resumo de hoje</strong>
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              {username ? `Olá, ${username}. ` : ''}No workspace{' '}
              <strong className='font-semibold'>{workspaceName}</strong>, você
              tem <strong className='font-semibold'>{queue}</strong> chamado(s)
              em aberto: <strong className='font-semibold'>{atRisk}</strong> com
              o prazo vencido ou perto de vencer e{' '}
              <strong className='font-semibold'>{waiting}</strong> aguardando
              resposta.
            </Text>
          </Section>
          {highlights.length > 0 ? (
            <Section>
              <Text className='text-[14px] leading-6.5 font-semibold'>
                Para começar por aqui:
              </Text>
              {highlights.map((item) => (
                <Text
                  key={item.code}
                  className='text-[14px] leading-6.5 font-light my-1'
                >
                  <Link href={item.url}>
                    <strong className='font-semibold'>{item.code}</strong>
                  </Link>{' '}
                  — {item.title}
                </Text>
              ))}
            </Section>
          ) : null}
          <Section className='my-5'>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#2893cc] text-white text-center font-semibold'
              style={{ width: '-webkit-fill-available' }}
              href={redirectUrl}
            >
              Abrir minha fila
            </Button>
          </Section>
          <Section>
            <Text className='text-[14px] leading-6.5 font-light'>
              Não quer mais este resumo? Desligue em Configurações &gt;
              Notificações, no ServiceDesk.
            </Text>
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

SdDailyDigest.PreviewProps = {
  email: 'agente@example.com',
  username: 'Ana',
  workspaceName: 'Stratus',
  queue: 12,
  atRisk: 3,
  waiting: 4,
  highlights: [
    {
      code: 'INC-000123',
      title: 'Servidor de e-mail fora do ar',
      url: 'https://steel.stratustelecom.com.br/ws/servicedesk/tickets/123',
    },
    {
      code: 'REQ-000045',
      title: 'Acesso ao ERP para o novo analista',
      url: 'https://steel.stratustelecom.com.br/ws/servicedesk/tickets/45',
    },
  ],
  redirectUrl: 'https://steel.stratustelecom.com.br/ws/servicedesk',
} satisfies SdDailyDigestEmailProps

export default SdDailyDigest
