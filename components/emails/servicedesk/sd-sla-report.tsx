import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'
import { baseEmailUrl } from '@/lib/base-email-url'
import { EmailFooter } from '../_components/email-footer'

export interface SdSlaReportEmailProps {
  email: string
  reportName: string
  workspaceName: string
  /** `01/09/2026 a 30/09/2026`, já no fuso do relatório. */
  periodLabel: string
  /** Linhas do resumo: rótulo → valor formatado. */
  indicators: { label: string; value: string }[]
  /** Chamados com prazo estourado, os mais atrasados primeiro. */
  violations: { code: string; title: string; customer: string | null; delay: string }[]
  violationCount: number
  /** `true` quando os arquivos foram anexados (senão, só o link). */
  attached: boolean
  formats: string[]
  redirectUrl: string
}

/** Relatório de SLA agendado (ou gerado sob demanda). */
export const SdSlaReport = ({
  reportName,
  workspaceName,
  periodLabel,
  indicators,
  violations,
  violationCount,
  attached,
  formats,
  redirectUrl,
}: SdSlaReportEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>{`Steel | ${reportName} — ${periodLabel}`}</Preview>
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
              <strong>{reportName}</strong>
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              Relatório de SLA do workspace{' '}
              <strong className='font-semibold'>{workspaceName}</strong>,
              período <strong className='font-semibold'>{periodLabel}</strong>.
            </Text>
          </Section>

          <Section>
            {indicators.map((indicator) => (
              <Text
                key={indicator.label}
                className='text-[14px] leading-6.5 font-light my-0.5'
              >
                {indicator.label}:{' '}
                <strong className='font-semibold'>{indicator.value}</strong>
              </Text>
            ))}
          </Section>

          {violations.length > 0 ? (
            <Section>
              <Text className='text-[14px] leading-6.5 font-semibold'>
                {violationCount} violação(ões) de SLA — as mais atrasadas:
              </Text>
              {violations.map((violation) => (
                <Text
                  key={violation.code}
                  className='text-[14px] leading-6.5 font-light my-1'
                >
                  <strong className='font-semibold'>{violation.code}</strong> —{' '}
                  {violation.title}
                  {violation.customer ? ` (${violation.customer})` : ''} ·{' '}
                  {violation.delay} de atraso
                </Text>
              ))}
            </Section>
          ) : (
            <Section>
              <Text className='text-[14px] leading-6.5 font-light'>
                Nenhuma violação de SLA no período.
              </Text>
            </Section>
          )}

          <Section>
            <Text className='text-[14px] leading-6.5 font-light'>
              {attached
                ? `O relatório completo vai anexo (${formats.join(' e ')}).`
                : 'Os arquivos ficaram grandes para o anexo — baixe-os pelo histórico de relatórios.'}
            </Text>
          </Section>

          <Section className='my-5'>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#2893cc] text-white text-center font-semibold'
              style={{ width: '-webkit-fill-available' }}
              href={redirectUrl}
            >
              Abrir o histórico de relatórios
            </Button>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

SdSlaReport.PreviewProps = {
  email: 'gestor@example.com',
  reportName: 'SLA mensal — clientes premium',
  workspaceName: 'Stratus',
  periodLabel: '01/09/2026 a 30/09/2026',
  indicators: [
    { label: 'Chamados abertos', value: '184' },
    { label: 'Chamados resolvidos', value: '176' },
    { label: 'SLA de primeira resposta', value: '97,2%' },
    { label: 'SLA de resolução', value: '94,8%' },
    { label: 'MTTR', value: '5 h 12 min' },
    { label: 'CSAT', value: '4,6' },
  ],
  violations: [
    {
      code: 'INC-000481',
      title: 'Link principal instável',
      customer: 'ACME',
      delay: '3 h 20 min',
    },
  ],
  violationCount: 4,
  attached: true,
  formats: ['PDF', 'CSV'],
  redirectUrl:
    'https://steel.stratustelecom.com.br/ws/servicedesk/settings?tab=reports',
} satisfies SdSlaReportEmailProps

export default SdSlaReport
