'use client'

import { RadarIcon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { useSdMonitorAlerts } from '@/src/hooks/use-sd-monitoring'
import type { SdMonitorAlertDTO } from '@/types/sd-monitor'
import type { SdTicketDTO } from '@/types/sd-ticket'

const STATUS_LABEL: Record<SdMonitorAlertDTO['status'], string> = {
  OPEN: 'Alerta aberto',
  RESOLVED: 'Alerta normalizado',
  IGNORED: 'Alerta ignorado',
}

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-2'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <span className='min-w-0 break-words text-xs'>{value}</span>
    </div>
  )
}

/**
 * Bloco de origem do chamado aberto pelo monitoramento: só aparece quando o
 * chamado veio do canal `API` e existe um alerta vinculado. Lê
 * `GET /servicedesk/monitor-alerts?ticketId=` (só agentes), então para o
 * solicitante o bloco simplesmente não renderiza.
 */
export function SdTicketMonitorBlock({
  workspaceId,
  ticket,
}: {
  workspaceId: string
  ticket: SdTicketDTO
}) {
  const { data } = useSdMonitorAlerts(
    workspaceId,
    { ticketId: ticket.id, limit: 1 },
    { enabled: ticket.channel === 'API' },
  )
  const alert = data?.[0]
  if (!alert) return null

  return (
    <section
      aria-label='Alerta de monitoramento'
      className='flex flex-col gap-2 rounded-lg border border-border bg-card p-3'
    >
      <header className='flex items-center justify-between gap-2'>
        <span className='flex items-center gap-1.5 font-medium text-sm'>
          <SteelIcon icon={RadarIcon} strokeWidth={2} />
          Monitoramento
        </span>
        <Badge variant={alert.status === 'OPEN' ? 'destructive' : 'outline'}>
          {STATUS_LABEL[alert.status]}
        </Badge>
      </header>
      <p className='text-xs'>{alert.subject}</p>
      <div className='flex flex-col gap-1'>
        <Row label='Origem' value={alert.sourceName} />
        {alert.host ? <Row label='Host' value={alert.host} /> : null}
        {alert.configItem ? (
          <Row label='Item de CI' value={alert.configItem.name} />
        ) : null}
        {alert.severity ? (
          <Row label='Severidade' value={alert.severity} />
        ) : null}
        <Row label='Evento' value={alert.externalId} />
        <Row
          label='Disparou'
          value={DATE_TIME.format(new Date(alert.startedAt))}
        />
        {alert.resolvedAt ? (
          <Row
            label='Normalizou'
            value={DATE_TIME.format(new Date(alert.resolvedAt))}
          />
        ) : null}
      </div>
    </section>
  )
}
