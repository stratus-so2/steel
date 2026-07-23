'use client'

import { Cancel01Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useRef, useState } from 'react'
import {
  CrmEmailCampaignRecipientPicker,
  type RecipientSelection,
} from '@/app/_components/crm/crm-email-campaign-recipient-picker'
import { EmailEditorShell } from '@/app/_components/crm/email-editor-shell'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { notify } from '@/lib/notify'
import {
  useCreateCrmEmailCampaign,
  useCrmEmailCampaignRecipients,
  useSendCrmEmailCampaign,
} from '@/src/hooks/use-crm-email-marketing'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type {
  CrmCampaignRecipientStatusDTO,
  CrmCampaignStatusDTO,
  CrmEmailCampaignDTO,
} from '@/types/crm-email-marketing'

type EditorRef = {
  getEmailHTML: () => Promise<string>
  getJSON: () => unknown
}

const STATUS_LABEL: Record<CrmCampaignStatusDTO, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  SENDING: 'Enviando',
  SENT: 'Enviada',
  FAILED: 'Falhou',
}

const STATUS_STYLE: Record<CrmCampaignStatusDTO, string> = {
  DRAFT: 'bg-muted text-foreground',
  SCHEDULED: 'bg-amber-500/20 text-amber-600',
  SENDING: 'bg-sky-500/20 text-sky-600',
  SENT: 'bg-emerald-500/20 text-emerald-600',
  FAILED: 'bg-destructive/20 text-destructive',
}

const RECIPIENT_LABEL: Record<CrmCampaignRecipientStatusDTO, string> = {
  PENDING: 'Pendente',
  SENT: 'Enviado',
  FAILED: 'Falhou',
}

const RECIPIENT_STYLE: Record<CrmCampaignRecipientStatusDTO, string> = {
  PENDING: 'text-muted-foreground',
  SENT: 'text-emerald-500',
  FAILED: 'text-destructive',
}

const STATUS_OPTIONS = (
  Object.keys(STATUS_LABEL) as CrmCampaignStatusDTO[]
).map((status) => ({ value: status, label: STATUS_LABEL[status] }))

const LOOKUP_KINDS: LookupKind[] = ['users']

const COLUMNS: GridColumn[] = [
  {
    key: 'subject',
    header: 'Assunto',
    kind: 'text',
    primary: true,
    readonly: true,
    placeholder: '—',
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'select',
    readonly: true,
    options: STATUS_OPTIONS,
    optionStyles: STATUS_STYLE,
  },
  {
    key: 'recipientCount',
    header: 'Destinatários',
    kind: 'number',
    readonly: true,
  },
  { key: 'sentCount', header: 'Enviados', kind: 'number', readonly: true },
  { key: 'failedCount', header: 'Falhas', kind: 'number', readonly: true },
  { key: 'scheduledAt', header: 'Agendada para', kind: 'readonly-date' },
  { key: 'sentAt', header: 'Enviada em', kind: 'readonly-date' },
  {
    key: 'createdById',
    header: 'Criada por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  { key: 'createdAt', header: 'Criada em', kind: 'readonly-date' },
]

export function CrmEmailCampaignsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmEmailCampaignDTO>(
    workspaceId,
    'email-campaigns',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const columns = useMemo(() => COLUMNS, [])
  const [viewing, setViewing] = useState<string | 'new' | null>(null)

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        workspaceId={workspaceId}
        slug={slug}
        resource='email-campaigns'
        createTitle='campanha'
        lookups={lookups}
        isLoading={isLoading}
        searchPlaceholder='Buscar campanhas…'
        refetch={refetch}
        disableInlineCreate
        headerAction={
          <Button size='sm' onClick={() => setViewing('new')}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova campanha
          </Button>
        }
        onOpenRecord={(record) => setViewing(record.id)}
      />

      <CampaignSheet
        workspaceId={workspaceId}
        viewing={viewing}
        onClose={() => setViewing(null)}
        onSent={() => {
          setViewing(null)
          refetch()
        }}
      />
    </>
  )
}

function CampaignSheet({
  workspaceId,
  viewing,
  onClose,
  onSent,
}: {
  workspaceId: string
  viewing: string | 'new' | null
  onClose: () => void
  onSent: () => void
}) {
  const open = viewing !== null
  const isNew = viewing === 'new'

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent
        side='right'
        showCloseButton={false}
        className='flex w-[640px] max-w-[640px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px] data-[side=right]:sm:max-w-[640px]'
      >
        {!open ? null : isNew ? (
          <CampaignComposer
            workspaceId={workspaceId}
            onClose={onClose}
            onSent={onSent}
          />
        ) : (
          <CampaignDetail
            workspaceId={workspaceId}
            id={viewing as string}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PanelHeader({
  onClose,
  title,
  badge,
}: {
  onClose: () => void
  title: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className='flex shrink-0 items-center gap-2 border-b p-3'>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={onClose}
        aria-label='Fechar'
      >
        <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
      </Button>
      <SheetTitle className='truncate'>{title}</SheetTitle>
      {badge}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className='grid gap-1.5'>
      <Label className='text-muted-foreground text-xs'>{label}</Label>
      <div className='min-w-0'>{children}</div>
    </div>
  )
}

function CampaignComposer({
  workspaceId,
  onClose,
  onSent,
}: {
  workspaceId: string
  onClose: () => void
  onSent: () => void
}) {
  const editorRef = useRef<EditorRef | null>(null)
  const [subject, setSubject] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAtLocal, setScheduledAtLocal] = useState('')
  const [recipients, setRecipients] = useState<RecipientSelection>({
    scope: 'ALL',
  })
  const createCampaign = useCreateCrmEmailCampaign(workspaceId)
  const sendCampaign = useSendCrmEmailCampaign(workspaceId)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit() {
    if (!subject.trim()) {
      notify.error('Informe o assunto')
      return
    }
    if (!fromAddress.trim()) {
      notify.error('Informe o remetente')
      return
    }
    if (
      recipients.scope === 'SELECTED' &&
      recipients.mode === 'people' &&
      recipients.personIds.length === 0
    ) {
      notify.error('Selecione ao menos uma pessoa')
      return
    }
    if (
      recipients.scope === 'SELECTED' &&
      recipients.mode === 'list' &&
      !recipients.mailingListId
    ) {
      notify.error('Selecione uma lista')
      return
    }

    const html = (await editorRef.current?.getEmailHTML())?.trim()
    if (!html) {
      notify.error('Conteúdo vazio')
      return
    }
    const json = JSON.stringify(editorRef.current?.getJSON() ?? null)

    let scheduledAt: string | undefined
    if (scheduleEnabled) {
      if (!scheduledAtLocal) {
        notify.error('Informe a data e hora do agendamento')
        return
      }
      const date = new Date(scheduledAtLocal)
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        notify.error('Data de agendamento deve ser no futuro')
        return
      }
      scheduledAt = date.toISOString()
    }

    setSubmitting(true)
    try {
      const created = await createCampaign.mutateAsync({
        subject,
        contentHtml: html,
        contentJson: json,
        fromAddress,
        recipientScope: recipients.scope,
        mailingListId:
          recipients.scope === 'SELECTED' && recipients.mode === 'list'
            ? recipients.mailingListId
            : undefined,
        personIds:
          recipients.scope === 'SELECTED' && recipients.mode === 'people'
            ? recipients.personIds
            : undefined,
        scheduledAt,
      })
      if (!scheduledAt) {
        await sendCampaign.mutateAsync(created.id)
      }
      notify.success(scheduledAt ? 'Campanha agendada' : 'Campanha enviada')
      onSent()
    } catch (err) {
      notify.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PanelHeader onClose={onClose} title='Nova campanha' />

      <div className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden'>
        <div className='flex flex-col gap-5 p-4'>
          <Field label='Assunto'>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder='Novidades de junho'
            />
          </Field>

          <Field label='Remetente'>
            <Input
              type='email'
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder='contato@suaempresa.com'
            />
          </Field>

          <Field label='Conteúdo'>
            <div className='min-h-[420px]'>
              <EmailEditorShell
                ref={(r) => {
                  editorRef.current = r as unknown as EditorRef | null
                }}
              />
            </div>
          </Field>

          <Field label='Destinatários'>
            <CrmEmailCampaignRecipientPicker
              workspaceId={workspaceId}
              value={recipients}
              onChange={setRecipients}
            />
          </Field>

          <Field label='Agendamento'>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                className='size-4 accent-primary'
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
              />
              <span>Enviar mais tarde</span>
            </label>
            {scheduleEnabled ? (
              <div className='mt-3 grid gap-1.5'>
                <Input
                  type='datetime-local'
                  value={scheduledAtLocal}
                  onChange={(e) => setScheduledAtLocal(e.target.value)}
                />
              </div>
            ) : null}
          </Field>
        </div>
      </div>

      <div className='flex shrink-0 items-center justify-end gap-2 border-t p-3'>
        <Button variant='ghost' onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting
            ? 'Enviando…'
            : scheduleEnabled
              ? 'Agendar envio'
              : 'Enviar agora'}
        </Button>
      </div>
    </>
  )
}

function CampaignDetail({
  workspaceId,
  id,
  onClose,
}: {
  workspaceId: string
  id: string
  onClose: () => void
}) {
  const { items: campaigns } = useCrmResourceList<CrmEmailCampaignDTO>(
    workspaceId,
    'email-campaigns',
  )
  const campaign = campaigns.find((c) => c.id === id)
  const { data: recipients, isLoading: recipientsLoading } =
    useCrmEmailCampaignRecipients(workspaceId, id)

  return (
    <>
      <PanelHeader
        onClose={onClose}
        title={campaign?.subject ?? 'Campanha'}
        badge={
          campaign ? (
            <span
              className={`ml-2 shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_STYLE[campaign.status]}`}
            >
              {STATUS_LABEL[campaign.status]}
            </span>
          ) : null
        }
      />

      <div className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden'>
        {!campaign ? (
          <div className='p-4 text-muted-foreground text-sm'>
            Campanha não encontrada
          </div>
        ) : (
          <div className='flex flex-col gap-5 p-4'>
            <Field label='De'>
              <span className='text-sm'>{campaign.fromAddress}</span>
            </Field>

            <Field label='Conteúdo'>
              <div
                className='prose prose-sm max-w-none rounded-lg border border-border bg-card p-4 dark:prose-invert'
                dangerouslySetInnerHTML={{ __html: campaign.contentHtml }}
              />
            </Field>

            <Field label='Resumo'>
              <dl className='grid grid-cols-3 gap-2 text-sm'>
                <Metric label='Destinatários' value={campaign.recipientCount} />
                <Metric
                  label='Enviados'
                  value={campaign.sentCount}
                  tone='emerald'
                />
                <Metric
                  label='Falhas'
                  value={campaign.failedCount}
                  tone='destructive'
                />
              </dl>
            </Field>

            <Field label={`Destinatários (${recipients?.length ?? 0})`}>
              {recipientsLoading ? null : (
                <ul className='max-h-96 divide-y divide-border overflow-auto rounded-lg border border-border'>
                  {recipients?.map((r) => (
                    <li key={r.id} className='px-3 py-2'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='min-w-0'>
                          <div className='truncate font-medium text-sm'>
                            {r.name ?? r.email}
                          </div>
                          {r.name ? (
                            <div className='truncate text-muted-foreground text-xs'>
                              {r.email}
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 text-xs ${RECIPIENT_STYLE[r.status]}`}
                        >
                          {RECIPIENT_LABEL[r.status]}
                        </span>
                      </div>
                      {r.errorMessage ? (
                        <div className='mt-1 truncate text-destructive text-xs'>
                          {r.errorMessage}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </div>
        )}
      </div>
    </>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'emerald' | 'destructive'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-500'
      : tone === 'destructive'
        ? 'text-destructive'
        : ''
  return (
    <div className='rounded-lg border border-border bg-card p-3'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd className={`mt-1 font-semibold text-lg ${toneClass}`}>{value}</dd>
    </div>
  )
}
