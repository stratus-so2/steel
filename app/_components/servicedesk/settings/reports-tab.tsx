'use client'

import {
  Calendar03Icon,
  Clock01Icon,
  Download04Icon,
  File02Icon,
  Mail01Icon,
  PencilEdit02Icon,
  PlayIcon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
import { SdCustomerPicker } from '@/app/_components/servicedesk/pickers'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  sdReportDownloadUrl,
  useCreateSdScheduledReport,
  useDeleteSdScheduledReport,
  useGenerateSdReport,
  useSdReportRuns,
  useSdScheduledReports,
  useUpdateSdScheduledReport,
} from '@/src/hooks/use-sd-reports'
import {
  formatSdReportDateTime,
  formatSdReportRange,
  sdReportNextRunAt,
  sdReportScheduleProblem,
} from '@/src/lib/servicedesk/report-schedule'
import {
  formatSdReportMinutes,
  formatSdReportPercent,
} from '@/src/lib/servicedesk/report-sla'
import type {
  CreateSdScheduledReportDTO,
  GenerateSdReportDTO,
} from '@/src/schemas/sd-report.schema'
import type { SdTicketTypeDTO } from '@/types/sd-config'
import type {
  SdReportFormatDTO,
  SdReportPeriodDTO,
  SdReportRunDTO,
  SdReportRunStatusDTO,
  SdScheduledReportDTO,
} from '@/types/sd-report'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  NumberInput,
  SettingsSection,
  SimpleSelect,
  TicketTypeToggles,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * Aba "Relatórios": agendamentos de relatório de SLA (recorte, período,
 * formatos, dia/hora/fuso e destinatários) e o histórico de execuções, com
 * download do PDF e do CSV. Toda data é formatada no **fuso do relatório** —
 * nunca no do navegador —, com a mesma lib que o worker usa, então a
 * pré-visualização do próximo envio é exatamente o que vai acontecer.
 */

const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

const PERIOD_OPTIONS: { value: SdReportPeriodDTO; label: string }[] = [
  { value: 'LAST_MONTH', label: 'Mês anterior' },
  { value: 'CURRENT_MONTH', label: 'Mês corrente (até agora)' },
  { value: 'LAST_WEEK', label: 'Últimos 7 dias' },
  { value: 'LAST_30_DAYS', label: 'Últimos 30 dias' },
  { value: 'LAST_90_DAYS', label: 'Últimos 90 dias' },
]

const PERIOD_LABEL = Object.fromEntries(
  PERIOD_OPTIONS.map((option) => [option.value, option.label]),
) as Record<SdReportPeriodDTO, string>

const TIMEZONE_OPTIONS = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Cuiaba',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
].map((value) => ({ value, label: value }))

const FORMATS: SdReportFormatDTO[] = ['PDF', 'CSV']

const STATUS_LABEL: Record<SdReportRunStatusDTO, string> = {
  GENERATED: 'Gerado',
  SENT: 'Enviado',
  FAILED: 'Falhou',
}

const STATUS_TONE: Record<SdReportRunStatusDTO, string> = {
  GENERATED: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  SENT: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  FAILED:
    'border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300',
}

/** "Dia 1 às 07:00 (America/Sao_Paulo)". */
function describeSchedule(report: {
  dayOfMonth: number
  atTime: string
  timezone: string
}): string {
  return `Dia ${report.dayOfMonth} às ${report.atTime} (${report.timezone})`
}

function scopeLabel(report: SdScheduledReportDTO): string {
  const parts: string[] = []
  parts.push(
    report.customers.length > 0
      ? report.customers.map((customer) => customer.name).join(', ')
      : report.customerIds.length > 0
        ? `${report.customerIds.length} cliente(s)`
        : 'Todos os clientes',
  )
  if (report.departments.length > 0) {
    parts.push(report.departments.map((d) => d.name).join(', '))
  }
  if (report.ticketTypes.length > 0) parts.push(report.ticketTypes.join(', '))
  return parts.join(' · ')
}

/* -------------------------------- Lista ---------------------------------- */

export function SdReportsTab() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const { data, isLoading, error } = useSdScheduledReports(workspaceId, {
    includeInactive: true,
  })
  const update = useUpdateSdScheduledReport(workspaceId)
  const remove = useDeleteSdScheduledReport(workspaceId)
  const generate = useGenerateSdReport(workspaceId)
  const [editing, setEditing] = useState<
    { mode: 'create' } | { mode: 'edit'; report: SdScheduledReportDTO } | null
  >(null)
  const [onDemand, setOnDemand] = useState(false)
  const reports = data ?? []

  return (
    <div className='flex flex-col gap-5'>
      <SettingsSection
        title='Relatórios agendados'
        description='Relatório de SLA apurado e enviado por e-mail sozinho: volume, cumprimento de prazo, MTTR, CSAT e as violações do período. O worker confere de hora em hora e nunca envia o mesmo período duas vezes.'
        actions={
          canEdit ? (
            <>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setOnDemand(true)}
              >
                <SteelIcon icon={PlayIcon} strokeWidth={2} />
                Gerar agora
              </Button>
              <Button size='sm' onClick={() => setEditing({ mode: 'create' })}>
                <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
                Novo relatório
              </Button>
            </>
          ) : null
        }
      >
        {error ? (
          <EmptyState>{error.message}</EmptyState>
        ) : !isLoading && reports.length === 0 ? (
          <EmptyState>
            Nenhum relatório agendado. Crie um para o cliente receber o SLA do
            mês sem ninguém precisar lembrar.
          </EmptyState>
        ) : (
          <div className='overflow-x-auto rounded-lg border border-border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
                <tr>
                  <th className='px-3 py-2 font-medium'>Relatório</th>
                  <th className='px-3 py-2 font-medium'>Período</th>
                  <th className='px-3 py-2 font-medium'>Agenda</th>
                  <th className='px-3 py-2 font-medium'>Próximo envio</th>
                  <th className='px-3 py-2 font-medium'>Ativo</th>
                  <th className='w-32 px-3 py-2' />
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className={cn(
                      'border-t border-border',
                      !report.active && 'opacity-60',
                    )}
                  >
                    <td className='max-w-72 px-3 py-2'>
                      <div className='truncate font-medium'>{report.name}</div>
                      <div className='truncate text-xs text-muted-foreground'>
                        {scopeLabel(report)}
                      </div>
                      <div className='mt-0.5 flex items-center gap-1 text-xs text-muted-foreground'>
                        <SteelIcon
                          icon={Mail01Icon}
                          strokeWidth={2}
                          className='size-3.5'
                        />
                        {report.recipients.length > 0
                          ? report.recipients.join(', ')
                          : 'Sem destinatário fixo'}
                        {report.includeAccountOwners
                          ? ' + responsáveis das contas'
                          : ''}
                      </div>
                    </td>
                    <td className='px-3 py-2 text-xs text-muted-foreground'>
                      {PERIOD_LABEL[report.period]}
                      <div className='mt-0.5 flex items-center gap-1'>
                        <SteelIcon
                          icon={File02Icon}
                          strokeWidth={2}
                          className='size-3.5'
                        />
                        {report.formats.join(' + ')}
                      </div>
                    </td>
                    <td className='px-3 py-2 text-xs text-muted-foreground'>
                      {describeSchedule(report)}
                    </td>
                    <td className='px-3 py-2 text-xs'>
                      {report.nextRunAt ? (
                        <span className='flex items-center gap-1.5 tabular-nums'>
                          <SteelIcon
                            icon={Clock01Icon}
                            strokeWidth={2}
                            className='size-3.5 text-muted-foreground'
                          />
                          {formatSdReportDateTime(
                            report.nextRunAt,
                            report.timezone,
                          )}
                        </span>
                      ) : (
                        <span className='text-muted-foreground'>Pausado</span>
                      )}
                    </td>
                    <td className='px-3 py-2'>
                      <Switch
                        checked={report.active}
                        disabled={!canEdit}
                        aria-label={report.active ? 'Pausar' : 'Retomar'}
                        onCheckedChange={(active) =>
                          update.mutate(
                            { id: report.id, data: { active } },
                            {
                              onError: (err) => notify.error(err),
                              onSuccess: () =>
                                notify.success(
                                  active
                                    ? 'Relatório retomado'
                                    : 'Relatório pausado',
                                ),
                            },
                          )
                        }
                      />
                    </td>
                    <td className='px-3 py-2'>
                      <div className='flex justify-end gap-1'>
                        {canEdit ? (
                          <>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon-xs'
                              aria-label={`Gerar agora ${report.name}`}
                              disabled={generate.isPending}
                              onClick={() =>
                                generate.mutate(
                                  { reportId: report.id },
                                  {
                                    onError: (err) => notify.error(err),
                                    onSuccess: (run) =>
                                      notify.success(
                                        run.status === 'SENT'
                                          ? `Relatório enviado para ${run.recipients.length} destinatário(s)`
                                          : 'Relatório gerado',
                                      ),
                                  },
                                )
                              }
                            >
                              <SteelIcon icon={PlayIcon} strokeWidth={2} />
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon-xs'
                              aria-label={`Editar ${report.name}`}
                              onClick={() =>
                                setEditing({ mode: 'edit', report })
                              }
                            >
                              <SteelIcon
                                icon={PencilEdit02Icon}
                                strokeWidth={2}
                              />
                            </Button>
                            <ConfirmDeleteButton
                              title='Excluir relatório agendado'
                              description={`"${report.name}" para de ser enviado. O histórico e os arquivos já gerados continuam disponíveis. Para só interromper, pause o relatório.`}
                              pending={remove.isPending}
                              onConfirm={() =>
                                remove.mutate(report.id, {
                                  onError: (err) => notify.error(err),
                                })
                              }
                            />
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>

      <SdReportHistory workspaceId={workspaceId} reports={reports} />

      {editing ? (
        <SdReportDialog
          workspaceId={workspaceId}
          report={editing.mode === 'edit' ? editing.report : null}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {onDemand ? (
        <SdReportGenerateDialog
          workspaceId={workspaceId}
          onClose={() => setOnDemand(false)}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------ Histórico -------------------------------- */

export function SdReportHistory({
  workspaceId,
  reports,
}: {
  workspaceId: string
  reports: SdScheduledReportDTO[]
}) {
  const { data, isLoading, error } = useSdReportRuns(workspaceId)
  const runs = data ?? []
  const timezoneOf = useMemo(() => {
    const byId = new Map(reports.map((report) => [report.id, report.timezone]))
    return (run: SdReportRunDTO) =>
      (run.reportId ? byId.get(run.reportId) : null) ?? DEFAULT_TIMEZONE
  }, [reports])

  return (
    <SettingsSection
      title='Histórico de execuções'
      description='Cada apuração registrada: o período, o que foi medido, para quem foi e os arquivos para baixar.'
    >
      {error ? (
        <EmptyState>{error.message}</EmptyState>
      ) : !isLoading && runs.length === 0 ? (
        <EmptyState>
          Nenhum relatório gerado ainda. Use "Gerar agora" para conferir o
          resultado antes do primeiro envio automático.
        </EmptyState>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
              <tr>
                <th className='px-3 py-2 font-medium'>Período</th>
                <th className='px-3 py-2 font-medium'>Resumo</th>
                <th className='px-3 py-2 font-medium'>Situação</th>
                <th className='px-3 py-2 font-medium'>Destinatários</th>
                <th className='w-28 px-3 py-2 font-medium'>Arquivos</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const timezone = timezoneOf(run)
                return (
                  <tr key={run.id} className='border-t border-border'>
                    <td className='px-3 py-2'>
                      <div className='flex items-center gap-1.5 tabular-nums'>
                        <SteelIcon
                          icon={Calendar03Icon}
                          strokeWidth={2}
                          className='size-3.5 text-muted-foreground'
                        />
                        {formatSdReportRange(
                          { start: run.periodStart, end: run.periodEnd },
                          timezone,
                        )}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {run.reportName ?? 'Sob demanda'}
                      </div>
                    </td>
                    <td className='px-3 py-2 text-xs text-muted-foreground'>
                      {run.summary ? (
                        <>
                          {run.summary.volume.opened} aberto(s) ·{' '}
                          {run.summary.volume.resolved} resolvido(s) · SLA{' '}
                          {formatSdReportPercent(
                            run.summary.resolution.compliance,
                          )}{' '}
                          · MTTR{' '}
                          {formatSdReportMinutes(
                            run.summary.resolution.averageMinutes,
                          )}{' '}
                          · {run.summary.violationCount} violação(ões)
                        </>
                      ) : (
                        (run.error ?? '—')
                      )}
                    </td>
                    <td className='px-3 py-2 text-xs'>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px]',
                          STATUS_TONE[run.status],
                        )}
                      >
                        {STATUS_LABEL[run.status]}
                      </span>
                      {run.sentAt ? (
                        <div className='mt-1 text-muted-foreground tabular-nums'>
                          {formatSdReportDateTime(run.sentAt, timezone)}
                        </div>
                      ) : null}
                    </td>
                    <td className='max-w-64 px-3 py-2 text-xs text-muted-foreground'>
                      {run.recipients.length > 0
                        ? run.recipients.join(', ')
                        : 'Ninguém (só os arquivos)'}
                    </td>
                    <td className='px-3 py-2'>
                      <div className='flex gap-1'>
                        {run.formats.map((format) => (
                          <Button
                            key={format}
                            type='button'
                            variant='outline'
                            size='xs'
                            render={
                              <a
                                href={sdReportDownloadUrl(
                                  workspaceId,
                                  run.id,
                                  format,
                                )}
                                aria-label={`Baixar ${format}`}
                              >
                                <SteelIcon
                                  icon={Download04Icon}
                                  strokeWidth={2}
                                />
                                {format}
                              </a>
                            }
                          />
                        ))}
                        {run.formats.length === 0 ? (
                          <span className='text-xs text-muted-foreground'>
                            —
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SettingsSection>
  )
}

/* -------------------------- Recorte de clientes -------------------------- */

function CustomerScope({
  workspaceId,
  customers,
  onChange,
}: {
  workspaceId: string
  customers: { id: string; name: string }[]
  onChange: (customers: { id: string; name: string }[]) => void
}) {
  return (
    <div className='flex flex-col gap-2'>
      <SdCustomerPicker
        workspaceId={workspaceId}
        value={null}
        allowCreate={false}
        placeholder='Adicionar cliente'
        onChange={(option) => {
          if (!option || customers.some((c) => c.id === option.id)) return
          onChange([...customers, { id: option.id, name: option.label }])
        }}
      />
      {customers.length > 0 ? (
        <div className='flex flex-wrap gap-1.5'>
          {customers.map((customer) => (
            <button
              key={customer.id}
              type='button'
              onClick={() =>
                onChange(customers.filter((c) => c.id !== customer.id))
              }
              className='rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs text-primary transition hover:bg-primary/20'
              aria-label={`Remover ${customer.name}`}
            >
              {customer.name} ×
            </button>
          ))}
        </div>
      ) : (
        <span className='text-[11px] text-muted-foreground'>
          Vazio = todos os clientes.
        </span>
      )}
    </div>
  )
}

function FormatToggles({
  value,
  onChange,
}: {
  value: SdReportFormatDTO[]
  onChange: (formats: SdReportFormatDTO[]) => void
}) {
  return (
    <div className='flex flex-wrap gap-1.5'>
      {FORMATS.map((format) => {
        const active = value.includes(format)
        return (
          <button
            key={format}
            type='button'
            aria-pressed={active}
            onClick={() =>
              onChange(
                active
                  ? value.filter((f) => f !== format)
                  : FORMATS.filter((f) => f === format || value.includes(f)),
              )
            }
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {format}
          </button>
        )
      })}
    </div>
  )
}

/** Lista de e-mails livres (um por linha no input, separados por vírgula). */
function RecipientsField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder='gestor@empresa.com, ops@empresa.com'
    />
  )
}

function parseRecipients(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,;\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes('@')),
    ),
  ]
}

/* -------------------------------- Editor --------------------------------- */

export function SdReportDialog({
  workspaceId,
  report,
  onClose,
}: {
  workspaceId: string
  report: SdScheduledReportDTO | null
  onClose: () => void
}) {
  const { config } = useSdSettingsContext()
  const create = useCreateSdScheduledReport(workspaceId)
  const update = useUpdateSdScheduledReport(workspaceId)

  const [name, setName] = useState(report?.name ?? '')
  const [customers, setCustomers] = useState(report?.customers ?? [])
  const [departmentIds, setDepartmentIds] = useState<string[]>(
    report?.departmentIds ?? [],
  )
  const [ticketTypes, setTicketTypes] = useState<SdTicketTypeDTO[]>(
    report?.ticketTypes ?? [],
  )
  const [period, setPeriod] = useState<SdReportPeriodDTO>(
    report?.period ?? 'LAST_MONTH',
  )
  const [formats, setFormats] = useState<SdReportFormatDTO[]>(
    report?.formats ?? ['PDF', 'CSV'],
  )
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(
    report?.dayOfMonth ?? 1,
  )
  const [atTime, setAtTime] = useState(report?.atTime ?? '07:00')
  const [timezone, setTimezone] = useState(report?.timezone ?? DEFAULT_TIMEZONE)
  const [recipients, setRecipients] = useState(
    (report?.recipients ?? []).join(', '),
  )
  const [includeAccountOwners, setIncludeAccountOwners] = useState(
    report?.includeAccountOwners ?? false,
  )

  const departments = (config?.departments ?? []).flatMap((department) => [
    { value: department.id, label: department.name },
    ...department.children.map((child) => ({
      value: child.id,
      label: `${department.name} › ${child.name}`,
    })),
  ])

  const schedule = {
    dayOfMonth: dayOfMonth ?? 1,
    atTime,
    timezone,
  }
  const problem = sdReportScheduleProblem(schedule)
  const parsedRecipients = parseRecipients(recipients)
  const next = problem ? null : sdReportNextRunAt(schedule, new Date())
  const saving = create.isPending || update.isPending

  async function save() {
    const payload: CreateSdScheduledReportDTO = {
      name: name.trim(),
      kind: 'SLA',
      customerIds: customers.map((customer) => customer.id),
      departmentIds,
      ticketTypes,
      period,
      formats,
      dayOfMonth: dayOfMonth ?? 1,
      atTime,
      timezone,
      recipients: parsedRecipients,
      includeAccountOwners,
      active: report?.active ?? true,
    }
    try {
      if (report) {
        const { kind: _kind, active: _active, ...data } = payload
        await update.mutateAsync({ id: report.id, data })
        notify.success('Relatório salvo')
      } else {
        await create.mutateAsync(payload)
        notify.success('Relatório agendado')
      }
      onClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {report ? 'Editar relatório' : 'Novo relatório agendado'}
          </DialogTitle>
          <DialogDescription>
            O período e o horário valem no fuso escolhido — não no fuso do
            servidor nem no do seu navegador.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <FieldBlock label='Nome'>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder='SLA mensal — clientes premium'
              autoFocus
            />
          </FieldBlock>

          <FieldBlock
            label='Clientes do recorte'
            hint='O relatório mede só os chamados desses clientes.'
          >
            <CustomerScope
              workspaceId={workspaceId}
              customers={customers}
              onChange={setCustomers}
            />
          </FieldBlock>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Departamento' hint='Vazio = todos.'>
              <SimpleSelect
                value={departmentIds[0] ?? null}
                onChange={(value) => setDepartmentIds(value ? [value] : [])}
                allowEmpty
                emptyLabel='Todos os departamentos'
                options={departments}
              />
            </FieldBlock>
            <FieldBlock label='Tipos de chamado'>
              <TicketTypeToggles
                value={ticketTypes}
                onChange={setTicketTypes}
              />
            </FieldBlock>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Período apurado'>
              <SimpleSelect
                value={period}
                onChange={(value) => setPeriod(value ?? 'LAST_MONTH')}
                options={PERIOD_OPTIONS}
              />
            </FieldBlock>
            <FieldBlock label='Formatos'>
              <FormatToggles value={formats} onChange={setFormats} />
            </FieldBlock>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <FieldBlock label='Dia do mês' hint='1 a 28.'>
              <NumberInput
                value={dayOfMonth}
                onCommit={setDayOfMonth}
                min={1}
                max={28}
              />
            </FieldBlock>
            <FieldBlock label='Horário' hint='Hora local do fuso escolhido.'>
              <Input
                type='time'
                value={atTime}
                onChange={(event) => setAtTime(event.target.value)}
              />
            </FieldBlock>
            <FieldBlock label='Fuso horário'>
              <SimpleSelect
                value={timezone}
                onChange={(value) => setTimezone(value ?? DEFAULT_TIMEZONE)}
                options={TIMEZONE_OPTIONS}
              />
            </FieldBlock>
          </div>

          <FieldBlock
            label='Destinatários'
            hint='E-mails livres, separados por vírgula — internos ou do cliente.'
          >
            <RecipientsField value={recipients} onChange={setRecipients} />
          </FieldBlock>

          <ToggleRow
            label='Mandar também para os responsáveis das contas'
            description='Soma o e-mail de cada cliente do recorte e de quem mantém o cadastro dele.'
            checked={includeAccountOwners}
            onCheckedChange={setIncludeAccountOwners}
          />

          <div className='rounded-lg border border-border bg-muted/40 p-3'>
            <h4 className='flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase'>
              <SteelIcon icon={Clock01Icon} strokeWidth={2} />
              Próximo envio
            </h4>
            {problem ? (
              <p className='mt-2 text-sm text-destructive'>{problem}</p>
            ) : (
              <p className='mt-2 text-sm'>
                {describeSchedule(schedule)} ·{' '}
                {next ? formatSdReportDateTime(next, timezone) : '—'}
                {parsedRecipients.length === 0 && !includeAccountOwners
                  ? ' · sem destinatário: os arquivos só ficam no histórico'
                  : ''}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={
              !name.trim() || formats.length === 0 || Boolean(problem) || saving
            }
            onClick={save}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------- Gerar sob demanda --------------------------- */

export function SdReportGenerateDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string
  onClose: () => void
}) {
  const generate = useGenerateSdReport(workspaceId)
  const { data } = useSdScheduledReports(workspaceId, {
    includeInactive: true,
  })
  const [reportId, setReportId] = useState<string | null>(null)
  const [period, setPeriod] = useState<SdReportPeriodDTO>('LAST_MONTH')
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [formats, setFormats] = useState<SdReportFormatDTO[]>(['PDF', 'CSV'])
  const [recipients, setRecipients] = useState('')

  async function run() {
    const payload: GenerateSdReportDTO = reportId
      ? {
          reportId,
          ...(recipients.trim()
            ? { recipients: parseRecipients(recipients) }
            : {}),
        }
      : {
          period,
          customerIds: customers.map((customer) => customer.id),
          formats,
          recipients: parseRecipients(recipients),
        }
    try {
      const run = await generate.mutateAsync(payload)
      notify.success(
        run.status === 'SENT'
          ? `Relatório enviado para ${run.recipients.length} destinatário(s)`
          : 'Relatório gerado — baixe no histórico',
      )
      onClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Gerar relatório agora</DialogTitle>
          <DialogDescription>
            Apura e envia na hora. Sem destinatário, os arquivos ficam no
            histórico para baixar.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <FieldBlock
            label='Agendamento'
            hint='Use um agendamento para repetir o recorte dele.'
          >
            <SimpleSelect
              value={reportId}
              onChange={setReportId}
              allowEmpty
              emptyLabel='Relatório pontual (sem agendamento)'
              options={(data ?? []).map((report) => ({
                value: report.id,
                label: report.name,
              }))}
            />
          </FieldBlock>

          {reportId ? null : (
            <>
              <FieldBlock label='Período apurado'>
                <SimpleSelect
                  value={period}
                  onChange={(value) => setPeriod(value ?? 'LAST_MONTH')}
                  options={PERIOD_OPTIONS}
                />
              </FieldBlock>
              <FieldBlock label='Clientes do recorte'>
                <CustomerScope
                  workspaceId={workspaceId}
                  customers={customers}
                  onChange={setCustomers}
                />
              </FieldBlock>
              <FieldBlock label='Formatos'>
                <FormatToggles value={formats} onChange={setFormats} />
              </FieldBlock>
            </>
          )}

          <FieldBlock
            label='Destinatários'
            hint={
              reportId
                ? 'Vazio = os destinatários do agendamento.'
                : 'Vazio = ninguém; o relatório fica só no histórico.'
            }
          >
            <RecipientsField value={recipients} onChange={setRecipients} />
          </FieldBlock>
        </div>

        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={generate.isPending || (!reportId && formats.length === 0)}
            onClick={run}
          >
            {generate.isPending ? 'Gerando...' : 'Gerar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
