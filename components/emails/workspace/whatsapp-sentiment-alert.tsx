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
import type { WhatsAppSentimentAlertEmailProps } from '@/types/mail'
import { EmailFooter } from '../_components/email-footer'

export const WhatsAppSentimentAlert = ({
  username,
  workspaceName,
  contactLabel,
  averageScore,
  redirectUrl,
}: WhatsAppSentimentAlertEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>
          Steel | Conversa com sentimento negativo: {contactLabel}
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
              <strong>Uma conversa precisa de atenção.</strong>
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              {username ? `Olá, ${username}. ` : ''}A conversa do WhatsApp com{' '}
              <strong className='font-semibold'>{contactLabel}</strong> no
              workspace <strong className='font-semibold'>{workspaceName}</strong>{' '}
              está com sentimento negativo (média {averageScore}, numa escala de
              -1 a 1).
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              Vale dar uma olhada antes que o cliente fique ainda mais
              insatisfeito.
            </Text>
          </Section>
          <Section className='my-5'>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#2893cc] text-white text-center font-semibold'
              style={{ width: '-webkit-fill-available' }}
              href={redirectUrl}
            >
              Abrir conversa
            </Button>
          </Section>
          <Section>
            <Text className='text-[14px] leading-6.5 font-light'>
              Ou copie e cole essa URL no seu navegador:{' '}
              <Link href={redirectUrl}>{redirectUrl}</Link>
            </Text>
            <Text className='text-[12px] leading-5 text-slate-500'>
              Você recebe este aviso porque está entre os destinatários do
              alerta de sentimento nas configurações de atendimento do WhatsApp.
            </Text>
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

WhatsAppSentimentAlert.PreviewProps = {
  email: 'supervisor@example.com',
  username: 'Beatriz',
  workspaceName: 'Clínica Exemplo',
  contactLabel: 'Maria Silva',
  averageScore: '-0,62',
  redirectUrl: 'https://steel.stratustelecom.com.br/clinica/zap',
} satisfies WhatsAppSentimentAlertEmailProps

export default WhatsAppSentimentAlert
