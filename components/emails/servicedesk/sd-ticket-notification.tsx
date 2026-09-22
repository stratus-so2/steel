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

export interface SdTicketNotificationEmailProps {
  email: string
  username?: string
  workspaceName: string
  /** `INC-000123`. */
  ticketCode: string
  ticketTitle: string
  /** Frase principal (ex.: "O chamado foi atribuído a você."). */
  headline: string
  message?: string
  redirectUrl: string
}

/** Aviso genérico de chamado do ServiceDesk (atribuição, SLA, escalonamento, automação). */
export const SdTicketNotification = ({
  username,
  workspaceName,
  ticketCode,
  ticketTitle,
  headline,
  message,
  redirectUrl,
}: SdTicketNotificationEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>
          Steel | {ticketCode} — {headline}
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
              <strong>{headline}</strong>
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              {username ? `Olá, ${username}. ` : ''}Chamado{' '}
              <strong className='font-semibold'>{ticketCode}</strong> —{' '}
              {ticketTitle}, no workspace{' '}
              <strong className='font-semibold'>{workspaceName}</strong>.
            </Text>
            {message ? (
              <Text className='text-[14px] leading-6.5 font-light'>
                {message}
              </Text>
            ) : null}
          </Section>
          <Section className='my-5'>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#2893cc] text-white text-center font-semibold'
              style={{ width: '-webkit-fill-available' }}
              href={redirectUrl}
            >
              Abrir chamado
            </Button>
          </Section>
          <Section>
            <Text className='text-[14px] leading-6.5 font-light'>
              Ou copie e cole essa URL no seu navegador:{' '}
              <Link href={redirectUrl}>{redirectUrl}</Link>
            </Text>
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

SdTicketNotification.PreviewProps = {
  email: 'agente@example.com',
  username: 'Ana',
  workspaceName: 'Stratus',
  ticketCode: 'INC-000123',
  ticketTitle: 'Servidor de e-mail fora do ar',
  headline: 'O chamado foi atribuído a você.',
  message: 'Prioridade P1 — prazo de 1ª resposta em 30 minutos.',
  redirectUrl: 'https://steel.stratustelecom.com.br/ws/servicedesk/tickets/123',
} satisfies SdTicketNotificationEmailProps

export default SdTicketNotification
