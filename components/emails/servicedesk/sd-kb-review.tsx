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

export interface SdKbReviewEmailProps {
  email: string
  username?: string
  workspaceName: string
  /** Frase principal (ex.: "Revisão de artigo pedida a você."). */
  headline: string
  /** Título do artigo, ou o resumo quando o aviso é de vários. */
  articleTitle: string
  message?: string
  redirectUrl: string
  /** Rótulo do botão (abrir o artigo ou a lista de revisões). */
  action?: string
}

/**
 * Aviso da base de conhecimento (KCS): revisão pedida, decidida ou vencida.
 * O artigo não é um chamado, por isso não reutiliza o e-mail de chamado.
 */
export const SdKbReview = ({
  username,
  workspaceName,
  headline,
  articleTitle,
  message,
  redirectUrl,
  action = 'Abrir artigo',
}: SdKbReviewEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>
          Steel | {headline} {articleTitle}
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
              {username ? `Olá, ${username}. ` : ''}
              <strong className='font-semibold'>{articleTitle}</strong>, na base
              de conhecimento do workspace{' '}
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
              {action}
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

SdKbReview.PreviewProps = {
  email: 'agente@example.com',
  username: 'Ana',
  workspaceName: 'Stratus',
  headline: 'Revisão de artigo pedida a você.',
  articleTitle: 'Como redefinir a senha da VPN',
  message: 'Bruno pediu sua revisão antes de publicar.',
  redirectUrl:
    'https://steel.stratustelecom.com.br/ws/servicedesk/knowledge/ckw1kbart',
  action: 'Revisar artigo',
} satisfies SdKbReviewEmailProps

export default SdKbReview
