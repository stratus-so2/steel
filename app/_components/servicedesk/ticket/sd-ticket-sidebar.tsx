'use client'

import {
  AiMagicIcon,
  ArrowDown01Icon,
  Cancel01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { type ReactNode, useState } from 'react'
import { SdAiCopilotPanel } from '@/app/_components/servicedesk/ai/copilot-panel'
import { SdPortalAccessButton } from '@/app/_components/servicedesk/external-portal'
import { SdTicketMonitorBlock } from '@/app/_components/servicedesk/monitoring/sd-ticket-monitor-block'
import { SteelIcon } from '@/components/icon/icon'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  type UpdateSdTicketInput,
  useAddSdTicketParticipant,
  useRemoveSdTicketParticipant,
  useUpdateSdTicket,
} from '@/src/hooks/use-sd-tickets'
import type { SdAgentDTO, SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { sdApplicableCustomFields } from '../custom-fields/sd-custom-fields-utils'
import { SdOptionSelect } from './sd-option-select'
import { SdTypeBadge, SdUserAvatar } from './sd-ticket-badges'
import { SdTicketFieldControl, sdIsDraftField } from './sd-ticket-field-control'
import { SD_CHANNEL_LABEL, sdFormatDateTime } from './sd-ticket-meta'
import { sdTicketFieldLabel, sdTicketFieldValue } from './sd-ticket-options'

/** Campo → corpo do PATCH (cascata do catálogo, campos customizados, vazios). */
export function sdFieldPatch(
  field: string,
  value: unknown,
): UpdateSdTicketInput {
  const normalized =
    typeof value === 'string' && value.trim() === '' ? null : value
  if (field.startsWith('customFields.')) {
    return { customFields: { [field.slice(13)]: normalized } }
  }
  const patch: Record<string, unknown> = { [field]: normalized }
  if (field === 'categoryId') {
    patch.subcategoryId = null
    patch.serviceId = null
  }
  if (field === 'subcategoryId') patch.serviceId = null
  return patch as UpdateSdTicketInput
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

interface FieldProps {
  workspaceId: string
  ticket: SdTicketDTO
  config: SdConfigBootstrapDTO
  agents: SdAgentDTO[]
  field: string
  label: string
  error?: string
  saving: boolean
  onSave: (field: string, value: unknown) => void
  disabled?: boolean
}

/** Linha editável da barra lateral (salva ao escolher ou ao sair do campo). */
function SidebarField({
  workspaceId,
  ticket,
  config,
  agents,
  field,
  label,
  error,
  saving,
  onSave,
  disabled,
}: FieldProps) {
  const server = sdTicketFieldValue(ticket, field)
  const [draft, setDraft] = useState<unknown>(server)
  const [synced, setSynced] = useState<unknown>(server)
  if (!same(server, synced)) {
    setSynced(server)
    setDraft(server)
  }
  const draftMode = sdIsDraftField(field, config)
  const id = `sd-side-${field.replace('.', '-')}`
  const wide =
    draftMode &&
    (field === 'solution' ||
      field.endsWith('Plan') ||
      field === 'rootCause' ||
      field === 'workaround')

  return (
    <div
      className={cn(
        'grid items-start gap-x-3 gap-y-1',
        wide ? 'grid-cols-1' : 'grid-cols-[7.5rem_minmax(0,1fr)]',
      )}
    >
      <label
        htmlFor={id}
        className='pt-2 text-muted-foreground text-xs leading-tight'
      >
        {label}
      </label>
      <div className='min-w-0'>
        <SdTicketFieldControl
          id={id}
          workspaceId={workspaceId}
          config={config}
          field={field}
          context={{
            type: ticket.type,
            categoryId: ticket.category?.id,
            subcategoryId: ticket.subcategory?.id,
            customerId: ticket.customer?.id,
            companyId: ticket.company?.id,
          }}
          agents={agents}
          value={draftMode ? draft : server}
          selectedLabel={sdTicketFieldLabel(ticket, field)}
          disabled={disabled || saving}
          invalid={Boolean(error)}
          onChange={(value) => {
            if (draftMode) setDraft(value)
            else if (!same(value, server)) onSave(field, value)
          }}
          onCommit={
            draftMode
              ? () => {
                  if (!same(draft, server)) onSave(field, draft)
                }
              : undefined
          }
        />
        {error ? (
          <p className='mt-1 text-destructive text-xs' role='alert'>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  defaultOpen = true,
  icon,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  icon?: ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className='border-b last:border-b-0'>
      <CollapsibleTrigger className='group flex w-full items-center gap-2 px-4 py-2.5 text-left'>
        {icon}
        <span className='font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
          {title}
        </span>
        <SteelIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className='ml-auto size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-0 -rotate-90'
        />
      </CollapsibleTrigger>
      <CollapsibleContent className='flex flex-col gap-2 px-4 pb-4'>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function ReadRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 text-sm'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <span className='min-w-0 truncate'>{children}</span>
    </div>
  )
}

function Participants({
  workspaceId,
  ticket,
  agents,
}: {
  workspaceId: string
  ticket: SdTicketDTO
  agents: SdAgentDTO[]
}) {
  const add = useAddSdTicketParticipant(workspaceId, ticket.id)
  const remove = useRemoveSdTicketParticipant(workspaceId, ticket.id)
  const current = new Set(ticket.participants.map((p) => p.id))
  return (
    <div className='grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3'>
      <span className='pt-1.5 text-muted-foreground text-xs'>
        Participantes
      </span>
      <div className='flex min-w-0 flex-col gap-1.5'>
        {ticket.participants.length > 0 ? (
          <ul className='flex flex-wrap gap-1'>
            {ticket.participants.map((p) => (
              <li
                key={p.id}
                className='inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-0.5 text-xs'
              >
                <SdUserAvatar user={p} className='size-4' />
                <span className='max-w-28 truncate'>{p.name}</span>
                <button
                  type='button'
                  aria-label={`Remover ${p.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(p.id, { onError: notify.error })}
                  className='rounded-full p-0.5 hover:bg-muted'
                >
                  <SteelIcon
                    icon={Cancel01Icon}
                    strokeWidth={2}
                    className='size-3'
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <SdOptionSelect
          aria-label='Adicionar participante'
          value={null}
          allowClear={false}
          placeholder='Adicionar…'
          disabled={add.isPending}
          onChange={(userId) =>
            userId && add.mutate(userId, { onError: notify.error })
          }
          options={agents
            .filter((a) => !current.has(a.id))
            .map((a) => ({ value: a.id, label: a.name }))}
        />
      </div>
    </div>
  )
}

/**
 * Barra lateral da tela do chamado: todos os campos editáveis inline
 * (salvam com `useUpdateSdTicket`, erro da API embaixo do campo),
 * participantes, campos customizados, campos de Mudança/Problema, datas e
 * o copiloto de IA (recolhível).
 */
export function SdTicketSidebar({
  workspaceId,
  ticket,
  config,
  agents,
  onPhaseChange,
}: {
  workspaceId: string
  ticket: SdTicketDTO
  config: SdConfigBootstrapDTO
  agents: SdAgentDTO[]
  onPhaseChange: (phaseId: string) => void
}) {
  const update = useUpdateSdTicket(workspaceId, ticket.id)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savingField, setSavingField] = useState<string | null>(null)

  function save(field: string, value: unknown) {
    setSavingField(field)
    update.mutate(sdFieldPatch(field, value), {
      onSuccess: () =>
        setErrors((current) => {
          const { [field]: _removed, ...rest } = current
          return rest
        }),
      onError: (error) =>
        setErrors((current) => ({ ...current, [field]: error.message })),
      onSettled: () => setSavingField(null),
    })
  }

  const field = (key: string, label: string) => (
    <SidebarField
      key={key}
      workspaceId={workspaceId}
      ticket={ticket}
      config={config}
      agents={agents}
      field={key}
      label={label}
      error={errors[key]}
      saving={savingField === key}
      onSave={save}
    />
  )

  const phases =
    config.phases
      .find((f) => f.ticketType === ticket.type)
      ?.phases.filter((p) => p.active || p.id === ticket.phaseId)
      .sort((a, b) => a.position - b.position) ?? []
  const customFields = sdApplicableCustomFields(config.customFields, 'TICKET', {
    ticketType: ticket.type,
    categoryIds: [
      ticket.category?.id,
      ticket.subcategory?.id,
      ticket.service?.id,
    ],
  })

  return (
    <aside
      aria-label='Campos do chamado'
      className='flex flex-col overflow-y-auto border-l bg-card/30'
    >
      <Section title='Detalhes'>
        <ReadRow label='Tipo'>
          <SdTypeBadge type={ticket.type} />
        </ReadRow>
        <div className='grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3'>
          <label
            htmlFor='sd-side-phase'
            className='text-muted-foreground text-xs'
          >
            Fase
          </label>
          <SdOptionSelect
            id='sd-side-phase'
            aria-label='Fase'
            allowClear={false}
            value={ticket.phaseId}
            onChange={(phaseId) => phaseId && onPhaseChange(phaseId)}
            options={phases.map((p) => ({
              value: p.id,
              label: p.name,
              color: p.color,
              hint: `${p.completionPercent}%`,
            }))}
          />
        </div>
        {field('priorityId', 'Prioridade')}
        {field('severityId', 'Severidade')}
        {field('impactId', 'Impacto')}
        {field('urgencyId', 'Urgência')}
        {field('classificationId', 'Classificação')}
        <ReadRow label='Canal'>{SD_CHANNEL_LABEL[ticket.channel]}</ReadRow>
        <SdTicketMonitorBlock workspaceId={workspaceId} ticket={ticket} />
      </Section>

      <Section title='Atendimento'>
        {field('assigneeId', 'Responsável')}
        {field('departmentId', 'Departamento')}
        {field('requesterId', 'Solicitante')}
        <Participants
          workspaceId={workspaceId}
          ticket={ticket}
          agents={agents}
        />
        {field('tags', 'Tags')}
      </Section>

      <Section title='Catálogo'>
        {field('categoryId', 'Categoria')}
        {field('subcategoryId', 'Subcategoria')}
        {field('serviceId', 'Serviço')}
      </Section>

      <Section title='Cliente'>
        {field('customerId', 'Cliente')}
        {field('companyId', 'Empresa')}
        {field('contactId', 'Contato')}
        {ticket.contact ? (
          <div className='px-1 pt-1'>
            <SdPortalAccessButton
              workspaceId={workspaceId}
              contactId={ticket.contact.id}
              contactEmail={ticket.contact.email}
              contactName={ticket.contact.name}
              size='xs'
            />
          </div>
        ) : null}
        {field('configItemId', 'Item de configuração')}
      </Section>

      <Section title='Solução' defaultOpen={Boolean(ticket.solution)}>
        {field('solutionClassificationId', 'Classificação da solução')}
        {field('solution', 'Solução')}
      </Section>

      {ticket.type === 'CHANGE' ? (
        <Section title='Mudança'>
          {field('changeType', 'Tipo de mudança')}
          {field('changeRisk', 'Risco')}
          {field('plannedStartAt', 'Início planejado')}
          {field('plannedEndAt', 'Fim planejado')}
          {field('implementationPlan', 'Plano de implantação')}
          {field('rollbackPlan', 'Plano de retorno')}
          {field('testPlan', 'Plano de testes')}
        </Section>
      ) : null}

      {ticket.type === 'PROBLEM' ? (
        <Section title='Problema'>
          {field('knownError', 'Erro conhecido')}
          {field('rootCause', 'Causa raiz')}
          {field('workaround', 'Solução de contorno')}
        </Section>
      ) : null}

      {customFields.length > 0 ? (
        <Section title='Campos customizados'>
          {customFields.map((d) => field(`customFields.${d.key}`, d.label))}
        </Section>
      ) : null}

      <Section title='Datas'>
        <ReadRow label='Aberto em'>
          {sdFormatDateTime(ticket.createdAt)}
        </ReadRow>
        <ReadRow label='1ª resposta'>
          {sdFormatDateTime(ticket.firstRespondedAt)}
        </ReadRow>
        <ReadRow label='Resolvido em'>
          {sdFormatDateTime(ticket.resolvedAt)}
        </ReadRow>
        <ReadRow label='Fechado em'>
          {sdFormatDateTime(ticket.closedAt)}
        </ReadRow>
        <ReadRow label='Última atividade'>
          {sdFormatDateTime(ticket.lastActivityAt)}
        </ReadRow>
        {ticket.reopenCount > 0 ? (
          <ReadRow label='Reaberturas'>{ticket.reopenCount}</ReadRow>
        ) : null}
        {ticket.createdBy ? (
          <ReadRow label='Aberto por'>{ticket.createdBy.name}</ReadRow>
        ) : null}
      </Section>

      <Section
        title='Copiloto de IA'
        defaultOpen={false}
        icon={
          <SteelIcon
            icon={AiMagicIcon}
            strokeWidth={2}
            className='size-4 text-violet-500'
          />
        }
      >
        <SdAiCopilotPanel workspaceId={workspaceId} ticket={ticket} />
        {config.settings.aiEnabled ? null : (
          <p className='text-muted-foreground text-xs'>
            A IA está desligada nas configurações do ServiceDesk.
          </p>
        )}
      </Section>
    </aside>
  )
}
