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

export interface SdPortalAccessEmailProps {
  email: string
  contactName: string
  workspaceName: string
  /** Agente que enviou o acesso; ausente quando o contato pediu sozinho. */
  sentByName?: string | null
  /** dd/mm/aaaa hh:mm (fuso America/Sao_Paulo). */
  expiresAtLabel: string
  /** `/suporte/entrar/<token>` — vale uma única vez. */
  accessUrl: string
  /** `/suporte` — onde pedir outro link. */
  supportUrl: string
}

/**
 * Link de acesso ao portal de atendimento, para o contato do cliente (que
 * não tem conta no Steel). O link abre uma sessão de 12 horas, vale **uma
 * única vez** e expira em 7 dias; o endereço nunca é repetido em log.
 */
export const SdPortalAccess = ({
  contactName,
  workspaceName,
  sentByName,
  expiresAtLabel,
  accessUrl,
  supportUrl,
}: SdPortalAccessEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>Seu acesso ao portal de atendimento — {workspaceName}</Preview>
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
              <strong>Seu acesso ao portal de atendimento</strong>
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              {contactName ? `Olá, ${contactName}. ` : 'Olá. '}
              {sentByName ? (
                <>
                  <strong className='font-semibold'>{sentByName}</strong>, da
                  equipe de{' '}
                  <strong className='font-semibold'>{workspaceName}</strong>,
                  enviou este acesso para você acompanhar e abrir chamados.
                </>
              ) : (
                <>
                  Use o botão abaixo para entrar no portal de atendimento de{' '}
                  <strong className='font-semibold'>{workspaceName}</strong> e
                  acompanhar seus chamados.
                </>
              )}
            </Text>
            <Text className='text-[13px] leading-6 font-light text-[#667085]'>
              O link vale uma única vez, até {expiresAtLabel}, e abre uma
              sessão de 12 horas. Não precisa de senha.
            </Text>
          </Section>
          <Section className='my-5'>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#101828] text-white text-center font-semibold'
              style={{ width: '-webkit-fill-available' }}
              href={accessUrl}
            >
              Entrar no portal
            </Button>
          </Section>
          <Section>
            <Text className='text-[14px] leading-6.5 font-light'>
              Ou copie e cole este endereço no seu navegador:{' '}
              <Link href={accessUrl}>{accessUrl}</Link>
            </Text>
            <Text className='text-[13px] leading-6 font-light text-[#667085]'>
              Se o link já tiver expirado, peça outro em{' '}
              <Link href={supportUrl}>{supportUrl}</Link>. Se não foi você que
              pediu este acesso, ignore este e-mail.
            </Text>
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

SdPortalAccess.PreviewProps = {
  email: 'ana@acme.com.br',
  contactName: 'Ana Souza',
  workspaceName: 'Stratus Telecom',
  sentByName: 'Carlos Atendimento',
  expiresAtLabel: '08/10/2026 09:30',
  accessUrl: 'https://steel.stratustelecom.com.br/suporte/entrar/abc123',
  supportUrl: 'https://steel.stratustelecom.com.br/suporte',
} satisfies SdPortalAccessEmailProps

export default SdPortalAccess
