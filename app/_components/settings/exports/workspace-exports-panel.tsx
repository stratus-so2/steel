'use client'

import {
  Database01Icon,
  Download01Icon,
  File01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import {
  EXPORT_TIMEZONE,
  formatBytes,
  formatDateTime,
  formatInteger,
} from '@/app/_components/settings/worklogs/worklog-format'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import {
  useRequestWorkspaceExport,
  useWorkspaceExports,
} from '@/src/hooks/use-workspace-exports'
import type {
  WorkspaceExportAvailabilityDTO,
  WorkspaceExportDTO,
  WorkspaceExportStatus,
} from '@/types/workspace-export'

const STATUS: Record<
  WorkspaceExportStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
  }
> = {
  PENDING: { label: 'Na fila', variant: 'secondary' },
  RUNNING: { label: 'Gerando', variant: 'secondary' },
  COMPLETED: { label: 'Pronto', variant: 'default' },
  FAILED: { label: 'Falhou', variant: 'destructive' },
  EXPIRED: { label: 'Expirado', variant: 'outline' },
}

const KIND_LABEL = {
  DATA: 'Dados completos',
  LOGS: 'Logs (Axiom)',
} as const

const LOG_PERIODS: Record<string, string> = {
  '1': 'Últimas 24 horas',
  '7': 'Últimos 7 dias',
  '30': 'Últimos 30 dias',
}

function at(iso: string): string {
  return formatDateTime(iso, EXPORT_TIMEZONE)
}

function SlotNote({
  slot,
}: {
  slot: WorkspaceExportAvailabilityDTO | undefined
}) {
  if (!slot) return null
  if (!slot.available && slot.nextAvailableAt) {
    return (
      <p className='text-muted-foreground text-xs'>
        Já exportado hoje. Disponível de novo em {at(slot.nextAvailableAt)}{' '}
        (horário de Brasília).
      </p>
    )
  }
  return (
    <p className='text-muted-foreground text-xs'>
      Uma exportação deste tipo por dia.
    </p>
  )
}

function HistoryRow({ item }: { item: WorkspaceExportDTO }) {
  const status = STATUS[item.status]
  const details = [
    item.requestedBy?.name ?? 'Usuário removido',
    at(item.createdAt),
    item.sizeBytes !== null ? formatBytes(item.sizeBytes) : null,
    item.itemCount !== null
      ? item.kind === 'DATA'
        ? `${formatInteger(item.itemCount)} tabelas`
        : `${formatInteger(item.itemCount)} eventos`
      : null,
  ].filter(Boolean)
  return (
    <li className='flex flex-wrap items-center gap-x-4 gap-y-2 py-3'>
      <div className='min-w-0 flex-1 space-y-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-medium text-sm'>{KIND_LABEL[item.kind]}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className='break-words text-muted-foreground text-xs'>
          {details.join(' · ')}
        </p>
        {item.status === 'FAILED' && item.errorMessage ? (
          <p className='break-words text-destructive text-xs'>
            {item.errorMessage}
          </p>
        ) : null}
        {item.downloadUrl && item.expiresAt ? (
          <p className='text-muted-foreground text-xs'>
            Disponível até {at(item.expiresAt)}
          </p>
        ) : null}
      </div>
      {item.downloadUrl ? (
        <Button
          variant='outline'
          size='sm'
          nativeButton={false}
          render={
            <a href={item.downloadUrl} download={item.fileName ?? true} />
          }
        >
          <SteelIcon icon={Download01Icon} size={14} />
          Baixar
        </Button>
      ) : null}
    </li>
  )
}

/** Ajustes › Exportações (OWNER/ADMIN). */
export function WorkspaceExportsPanel({
  workspaceId,
}: {
  workspaceId: string
}) {
  const overview = useWorkspaceExports(workspaceId)
  const request = useRequestWorkspaceExport(workspaceId)
  const [logDays, setLogDays] = useState<'1' | '7' | '30'>('7')

  const slot = (kind: 'DATA' | 'LOGS') =>
    overview.data?.availability.find((a) => a.kind === kind)
  const dataSlot = slot('DATA')
  const logsSlot = slot('LOGS')

  const run = (input: Parameters<typeof request.mutate>[0]) =>
    request.mutate(input, {
      onSuccess: () =>
        notify.success(
          'Exportação na fila. Avisaremos por notificação e e-mail quando estiver pronta.',
        ),
      onError: (error) => notify.error(error),
    })

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <SteelIcon icon={Database01Icon} size={18} />
              Dados completos do workspace
            </CardTitle>
            <CardDescription>
              Todas as tabelas do workspace — ServiceDesk, CRM, Comunicação,
              projetos e ajustes — em JSON e CSV, num arquivo ZIP. Senhas,
              tokens e credenciais ficam de fora.
            </CardDescription>
          </CardHeader>
          <CardFooter className='flex flex-col items-start gap-2'>
            <Button
              onClick={() => run({ kind: 'DATA' })}
              disabled={!dataSlot?.available || request.isPending}
            >
              Exportar dados
            </Button>
            <SlotNote slot={dataSlot} />
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <SteelIcon icon={File01Icon} size={18} />
              Logs do workspace
            </CardTitle>
            <CardDescription>
              Requisições à API e eventos de auditoria do workspace registrados
              no Axiom, em CSV e NDJSON.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logsSlot && !logsSlot.configured ? (
              <p
                className='rounded-lg border border-dashed px-3 py-2 text-muted-foreground text-sm'
                data-testid='logs-unconfigured'
              >
                A exportação de logs não está disponível neste servidor: a
                consulta ao Axiom não foi configurada. Fale com o suporte da
                Stratus para ativá-la.
              </p>
            ) : (
              <Select
                value={logDays}
                onValueChange={(value) => {
                  if (value === '1' || value === '7' || value === '30') {
                    setLogDays(value)
                  }
                }}
              >
                <SelectTrigger
                  aria-label='Período dos logs'
                  className='w-full sm:w-52'
                >
                  <SelectValue>
                    {(value: string) => LOG_PERIODS[value]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {Object.entries(LOG_PERIODS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </CardContent>
          <CardFooter className='flex flex-col items-start gap-2'>
            <Button
              onClick={() =>
                run({
                  kind: 'LOGS',
                  periodDays: Number(logDays) as 1 | 7 | 30,
                })
              }
              disabled={
                !logsSlot?.configured ||
                !logsSlot.available ||
                request.isPending
              }
            >
              Exportar logs
            </Button>
            {logsSlot?.configured ? <SlotNote slot={logsSlot} /> : null}
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>
            Os arquivos ficam disponíveis por{' '}
            {overview.data?.retentionDays ?? 7} dias. Só o dono e os
            administradores podem baixá-los; cada download é registrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.isPending ? (
            <div className='space-y-2' data-testid='exports-loading'>
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          ) : overview.isError ? (
            <p className='text-destructive text-sm'>{overview.error.message}</p>
          ) : overview.data.items.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              Nenhuma exportação ainda.
            </p>
          ) : (
            <ul className='divide-y'>
              {overview.data.items.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
