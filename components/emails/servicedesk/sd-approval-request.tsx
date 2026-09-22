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

export interface SdApprovalRequestEmailProps {
  email: string
  approverName?: string | null
  workspaceName: string
  /** `CHG-000045`. */
  ticketCode: string
  ticketTitle: string
  requestedByName: string
  message?: string | null
  /** dd/mm/aaaa hh:mm (fuso America/Sao_Paulo). */
  expiresAtLabel: string
  approveUrl: string
  rejectUrl: string
  /** Página do link, sem decisão pré-escolhida. */
  reviewUrl: string
}

/**
 * Pedido de aprovação de chamado do ServiceDesk. Os botões levam à página
 * pública `/servicedesk/approval/<token>` com a decisão pré-selecionada — a
 * resposta só vale após o clique de confirmação na página (scanners de link
 * não aprovam nada sozinhos).
 */
export const SdApprovalRequest = ({
  approverName,
  workspaceName,
  ticketCode,
  ticketTitle,
  requestedByName,
  message,
  expiresAtLabel,
  approveUrl,
  rejectUrl,
  reviewUrl,
}: SdApprovalRequestEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>
          Steel | Aprovação solicitada — {ticketCode}
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
              <strong>Sua aprovação foi solicitada</strong>
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              {approverName ? `Olá, ${approverName}. ` : ''}
              <strong className='font-semibold'>{requestedByName}</strong>{' '}
              pediu sua aprovação para o chamado{' '}
              <strong className='font-semibold'>{ticketCode}</strong> —{' '}
              {ticketTitle}, no workspace{' '}
              <strong className='font-semibold'>{workspaceName}</strong>.
            </Text>
            {message ? (
              <Text className='text-[14px] leading-6.5 font-light italic border-l-2 border-[#d0d5dd] pl-3'>
                {message}
              </Text>
            ) : null}
            <Text className='text-[13px] leading-6 font-light text-[#667085]'>
              O link vale até {expiresAtLabel}.
            </Text>
          </Section>
          <Section className='my-5'>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#16a34a] text-white text-center font-semibold mb-3'
              style={{ width: '-webkit-fill-available' }}
              href={approveUrl}
            >
              Aprovar
            </Button>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#dc2626] text-white text-center font-semibold'
              style={{ width: '-webkit-fill-available' }}
              href={rejectUrl}
            >
              Reprovar
            </Button>
          </Section>
          <Section>
            <Text className='text-[14px] leading-6.5 font-light'>
              Ou copie e cole essa URL no seu navegador:{' '}
              <Link href={reviewUrl}>{reviewUrl}</Link>
            </Text>
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

SdApprovalRequest.PreviewProps = {
  email: 'gestor@example.com',
  approverName: 'Carlos Gestor',
  workspaceName: 'Stratus',
  ticketCode: 'CHG-000045',
  ticketTitle: 'Atualização do firewall de borda',
  requestedByName: 'Ana Agente',
  message: 'Janela de manutenção sábado, 22h às 23h.',
  expiresAtLabel: '29/09/2026 18:00',
  approveUrl:
    'https://steel.stratustelecom.com.br/servicedesk/approval/abc?decision=APPROVED',
  rejectUrl:
    'https://steel.stratustelecom.com.br/servicedesk/approval/abc?decision=REJECTED',
  reviewUrl: 'https://steel.stratustelecom.com.br/servicedesk/approval/abc',
} satisfies SdApprovalRequestEmailProps

export default SdApprovalRequest
