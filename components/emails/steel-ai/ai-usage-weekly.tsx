import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from 'react-email'
import {
  formatChange,
  formatInteger,
  formatRange,
  formatShare,
  formatUsd,
} from '@/app/_components/steel-ai-usage/usage-format'
import { baseEmailUrl } from '@/lib/base-email-url'
import type {
  AiUsageWeeklyItemDTO,
  AiUsageWeeklyReportDTO,
} from '@/types/ai-usage'
import { EmailFooter } from '../_components/email-footer'

export interface AiUsageWeeklyEmailProps {
  email: string
  username?: string
  workspaceName: string
  report: AiUsageWeeklyReportDTO
  /** Absolute URL of Steel AI > Uso. */
  usageUrl: string
  /** Absolute URL of Steel AI > Análises. */
  analyticsUrl: string
  /** Absolute URL of Ajustes > Steel IA (to turn the e-mail off). */
  settingsUrl: string
}

const BRAND = '#2893cc'
const MUTED = '#64748b'
const TRACK = '#e2e8f0'
const DANGER = '#dc2626'
const WARNING = '#d97706'

const monthName = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  timeZone: 'UTC',
})

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
})

function changeLine(report: AiUsageWeeklyReportDTO): {
  text: string
  color: string
} {
  const { changePercent, previousWeekUsd } = report
  if (changePercent === null) {
    return {
      text: 'Sem consumo na semana anterior para comparar.',
      color: MUTED,
    }
  }
  const previous = `semana anterior: ${formatUsd(previousWeekUsd)}`
  if (changePercent > 0) {
    return {
      text: `▲ ${formatChange(changePercent)} em relação à ${previous}`,
      color: WARNING,
    }
  }
  if (changePercent < 0) {
    return {
      text: `▼ ${formatChange(changePercent)} em relação à ${previous}`,
      color: '#16a34a',
    }
  }
  return { text: `Igual à ${previous}`, color: MUTED }
}

function TopList({
  title,
  items,
  empty,
}: {
  title: string
  items: AiUsageWeeklyItemDTO[]
  empty: string
}) {
  return (
    <Section className='mt-6'>
      <Text className='text-[14px] leading-5 font-semibold m-0 mb-2'>
        {title}
      </Text>
      {items.length === 0 ? (
        <Text className='text-[13px] leading-5 m-0' style={{ color: MUTED }}>
          {empty}
        </Text>
      ) : (
        items.map((item, index) => (
          <Row
            key={item.key}
            style={{ borderTop: index === 0 ? undefined : `1px solid ${TRACK}` }}
          >
            <Column className='py-2 pr-3'>
              <Text className='text-[13px] leading-5 m-0'>
                {index + 1}. {item.label}
              </Text>
              {item.detail ? (
                <Text
                  className='text-[12px] leading-4 m-0'
                  style={{ color: MUTED }}
                >
                  {item.detail}
                </Text>
              ) : null}
            </Column>
            <Column className='py-2 text-right' style={{ width: '120px' }}>
              <Text className='text-[13px] leading-5 m-0 font-semibold'>
                {formatUsd(item.costUsd)}
              </Text>
              <Text
                className='text-[12px] leading-4 m-0'
                style={{ color: MUTED }}
              >
                {formatShare(item.share)}
              </Text>
            </Column>
          </Row>
        ))
      )}
    </Section>
  )
}

function ProgressBar({ share }: { share: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(share * 100)))
  const color = share >= 1 ? DANGER : share >= 0.8 ? WARNING : BRAND
  return (
    <table
      width='100%'
      cellPadding={0}
      cellSpacing={0}
      role='presentation'
      style={{
        borderCollapse: 'separate',
        backgroundColor: TRACK,
        borderRadius: '6px',
        height: '10px',
        tableLayout: 'fixed',
      }}
    >
      <tbody>
        <tr>
          {percent > 0 ? (
            <td
              style={{
                width: `${percent}%`,
                backgroundColor: color,
                borderRadius: '6px',
                height: '10px',
                lineHeight: '10px',
                fontSize: '1px',
              }}
            >
              &nbsp;
            </td>
          ) : null}
          {percent < 100 ? (
            <td style={{ height: '10px', lineHeight: '10px', fontSize: '1px' }}>
              &nbsp;
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  )
}

/** Resumo semanal do consumo do Steel AI, para os donos do workspace. */
export const AiUsageWeekly = ({
  username,
  workspaceName,
  report,
  usageUrl,
  analyticsUrl,
  settingsUrl,
}: AiUsageWeeklyEmailProps) => {
  const range = formatRange(report.weekStart, report.weekEnd)
  const change = changeLine(report)
  const month = report.month
  const monthLabel = monthName.format(new Date(month.start))
  const asOf = dayMonth.format(new Date(`${month.asOf}T00:00:00Z`))
  const monthClosed = month.elapsedDays >= month.days

  return (
    <Html lang='pt-BR'>
      <Head />
      <Tailwind>
        <Body className='bg-[#f4f5f5] font-sans py-6'>
          <Preview>
            {`Steel AI | ${workspaceName}: ${formatUsd(report.weekUsd)} na semana ${range}`}
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
              <Text className='text-2xl leading-7.5 m-0'>
                <strong>Consumo do Steel AI na semana</strong>
              </Text>
              <Text className='text-[14px] leading-6.5 font-light'>
                {username ? `Olá, ${username}. ` : ''}Este é o resumo do uso de
                IA no espaço de trabalho{' '}
                <strong className='font-semibold'>{workspaceName}</strong> de{' '}
                {range} (semana UTC, de segunda a domingo). Os valores são o
                custo real de cada chamada, em dólares.
              </Text>
            </Section>

            <Section
              className='rounded-md px-5 py-4'
              style={{ border: `1px solid ${TRACK}` }}
            >
              <Text
                className='text-[12px] leading-4 m-0 uppercase'
                style={{ color: MUTED, letterSpacing: '0.04em' }}
              >
                Gasto na semana
              </Text>
              <Text className='text-[32px] leading-10 m-0 font-semibold'>
                {formatUsd(report.weekUsd)}
              </Text>
              <Text
                className='text-[13px] leading-5 m-0'
                style={{ color: change.color }}
              >
                {change.text}
              </Text>
            </Section>

            <Section
              className='rounded-md px-5 py-4 mt-4'
              style={{ border: `1px solid ${TRACK}` }}
            >
              <Text
                className='text-[12px] leading-4 m-0 uppercase'
                style={{ color: MUTED, letterSpacing: '0.04em' }}
              >
                {monthClosed
                  ? `Mês de ${monthLabel} (fechado)`
                  : `Mês de ${monthLabel}, até ${asOf}`}
              </Text>
              <Text className='text-[14px] leading-6 m-0 mb-2'>
                <strong className='font-semibold'>
                  {formatUsd(month.usedUsd)}
                </strong>
                {month.quotaUsd > 0 ? (
                  <>
                    {' '}
                    de {formatUsd(month.quotaUsd)} da cota mensal (
                    {formatShare(month.usedShare ?? 0)})
                  </>
                ) : (
                  ' — sem cota mensal definida'
                )}
              </Text>
              {month.quotaUsd > 0 ? (
                <ProgressBar share={month.usedShare ?? 0} />
              ) : null}
              {monthClosed ? null : (
                <Text
                  className='text-[13px] leading-5 mt-3 mb-0'
                  style={{ color: MUTED }}
                >
                  No ritmo atual, o mês deve fechar em{' '}
                  <strong>{formatUsd(month.projectedUsd)}</strong>.
                </Text>
              )}
              {month.projectionExceedsQuota && !monthClosed ? (
                <Text
                  className='text-[13px] leading-5 mt-2 mb-0 font-semibold'
                  style={{ color: DANGER }}
                >
                  Atenção: a projeção passa da cota. Quando a cota acaba, as
                  chamadas de IA ficam bloqueadas até o mês seguinte — ajuste a
                  cota em Ajustes &gt; Steel IA se precisar.
                </Text>
              ) : null}
            </Section>

            <TopList
              title='Modelos que mais gastaram'
              items={report.topModels}
              empty='Nenhum consumo nesta semana.'
            />
            <TopList
              title='Recursos que mais gastaram'
              items={report.topFeatures}
              empty='Nenhum consumo nesta semana.'
            />
            <TopList
              title='Por módulo'
              items={report.topModules}
              empty='Nenhum consumo nesta semana.'
            />
            <TopList
              title='Pessoas que mais usaram'
              items={report.topMembers}
              empty='Só automações usaram IA nesta semana.'
            />

            {report.agents ? (
              <Section className='mt-6'>
                <Text className='text-[14px] leading-5 font-semibold m-0 mb-2'>
                  Steel Agents
                </Text>
                <Text className='text-[13px] leading-5 m-0'>
                  {formatInteger(report.agents.runs)} execuç
                  {report.agents.runs === 1 ? 'ão' : 'ões'} e{' '}
                  {formatInteger(report.agents.actions)} aç
                  {report.agents.actions === 1 ? 'ão' : 'ões'} executada
                  {report.agents.actions === 1 ? '' : 's'} na semana.
                </Text>
                {report.agents.pendingApprovals > 0 ? (
                  <Text
                    className='text-[13px] leading-5 m-0 mt-1 font-semibold'
                    style={{ color: WARNING }}
                  >
                    {formatInteger(report.agents.pendingApprovals)} aprovaç
                    {report.agents.pendingApprovals === 1 ? 'ão' : 'ões'}{' '}
                    aguardando decisão na caixa de entrada.
                  </Text>
                ) : null}
              </Section>
            ) : null}

            <Section className='mt-8'>
              <Button
                className='rounded-sm py-3 px-2.5 text-white text-center font-semibold'
                style={{
                  width: '-webkit-fill-available',
                  backgroundColor: BRAND,
                }}
                href={usageUrl}
              >
                Ver o uso
              </Button>
            </Section>
            <Section className='mt-3 mb-5'>
              <Button
                className='rounded-sm py-3 px-2.5 text-center font-semibold'
                style={{
                  width: '-webkit-fill-available',
                  color: BRAND,
                  border: `1px solid ${BRAND}`,
                }}
                href={analyticsUrl}
              >
                Abrir as análises
              </Button>
            </Section>

            <Hr style={{ borderColor: TRACK }} />
            <Text className='text-[12px] leading-5 font-light' style={{ color: MUTED }}>
              Você recebe este e-mail por ser dono do espaço de trabalho. Para
              não receber mais, desligue "Resumo semanal de consumo por e-mail"
              em{' '}
              <Link href={settingsUrl} style={{ color: BRAND }}>
                Ajustes &gt; Steel IA
              </Link>
              .
            </Text>
            <EmailFooter />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

AiUsageWeekly.PreviewProps = {
  email: 'dono@example.com',
  username: 'Ana',
  workspaceName: 'Stratus',
  report: {
    weekStart: '2026-09-28T00:00:00.000Z',
    weekEnd: '2026-10-05T00:00:00.000Z',
    weekUsd: 18.42,
    previousWeekUsd: 14.1,
    changePercent: 30.6,
    month: {
      start: '2026-10-01T00:00:00.000Z',
      asOf: '2026-10-04',
      days: 31,
      elapsedDays: 4,
      usedUsd: 11.3,
      quotaUsd: 50,
      usedShare: 0.226,
      projectedUsd: 87.58,
      projectionExceedsQuota: true,
    },
    topModels: [
      {
        key: 'anthropic:claude-sonnet',
        label: 'Claude Sonnet',
        detail: 'anthropic',
        costUsd: 12.1,
        share: 0.657,
      },
      {
        key: 'openai:gpt',
        label: 'GPT',
        detail: 'openai',
        costUsd: 5.02,
        share: 0.273,
      },
      {
        key: 'anthropic:claude-haiku',
        label: 'Claude Haiku',
        detail: 'anthropic',
        costUsd: 1.3,
        share: 0.07,
      },
    ],
    topFeatures: [
      {
        key: 'STEEL_ASSISTANT',
        label: 'Steel AI (assistente)',
        detail: null,
        costUsd: 10.4,
        share: 0.565,
      },
      {
        key: 'STEEL_AGENT',
        label: 'Steel Agents',
        detail: null,
        costUsd: 5.2,
        share: 0.282,
      },
      {
        key: 'WHATSAPP_REPLY',
        label: 'Resposta automática do WhatsApp',
        detail: null,
        costUsd: 2.82,
        share: 0.153,
      },
    ],
    topModules: [
      {
        key: 'SERVICE_DESK',
        label: 'ServiceDesk',
        detail: null,
        costUsd: 9.1,
        share: 0.494,
      },
      {
        key: 'CRM',
        label: 'CRM',
        detail: null,
        costUsd: 6.5,
        share: 0.353,
      },
      {
        key: 'COMMUNICATION',
        label: 'Comunicação',
        detail: null,
        costUsd: 2.82,
        share: 0.153,
      },
    ],
    topMembers: [
      {
        key: 'u1',
        label: 'Ana Souza',
        detail: 'ana@example.com',
        costUsd: 6.2,
        share: 0.337,
      },
      {
        key: 'u2',
        label: 'Bruno Lima',
        detail: 'bruno@example.com',
        costUsd: 3.4,
        share: 0.185,
      },
    ],
    agents: { runs: 42, actions: 17, pendingApprovals: 3 },
  },
  usageUrl: 'https://steel.stratustelecom.com.br/stratus/ai/usage',
  analyticsUrl: 'https://steel.stratustelecom.com.br/stratus/ai/analytics',
  settingsUrl:
    'https://steel.stratustelecom.com.br/stratus/settings/steel-intelligence',
} satisfies AiUsageWeeklyEmailProps

export default AiUsageWeekly
