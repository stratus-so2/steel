'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSdAgents, useSdConfig } from '@/src/hooks/use-sd-config'
import { addSdTicketParticipants } from '@/src/hooks/use-sd-ticket-ui'
import {
  type CreateSdTicketInput,
  useCreateSdTicket,
} from '@/src/hooks/use-sd-tickets'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdTicketDTO, SdTicketTypeDTO } from '@/types/sd-ticket'
import { SdMultiSelect } from '../board/sd-multi-select'
import { SdCustomFieldsForm } from '../custom-fields/sd-custom-fields-form'
import {
  sdApplicableCustomFields,
  sdCustomFieldDefaults,
  sdCustomFieldPayload,
  sdCustomFieldRequiredErrors,
} from '../custom-fields/sd-custom-fields-utils'
import { SdKbDraftSuggestions } from '../knowledge'
import { SdOptionSelect } from './sd-option-select'
import { SdRichTextEditor } from './sd-rich-text-editor'
import { SdLevelBadge } from './sd-ticket-badges'
import { SdTicketFieldControl } from './sd-ticket-field-control'
import {
  SD_TICKET_TYPE_LABEL,
  SD_TICKET_TYPES,
  sdTicketHref,
} from './sd-ticket-meta'
import { sdMatrixPriority } from './sd-ticket-options'
import { SdTicketPicker } from './sd-ticket-picker'

/** Valores do formulário de abertura (chaves = campos da API). */
export interface SdCreateTicketDraft {
  type: SdTicketTypeDTO
  templateId: string | null
  title: string
  description: string
  manualPriority: boolean
  values: Record<string, unknown>
  customFields: Record<string, unknown>
  participantIds: string[]
  parent: { id: string; label: string } | null
}

/** Pré-preenchimento (ex.: "novo item filho", "novo nesta coluna"). */
export interface SdCreateTicketPreset {
  type?: SdTicketTypeDTO
  phaseId?: string
  parent?: { id: string; label: string } | null
  values?: Record<string, unknown>
  /** Rótulos dos valores pré-preenchidos de seletores assíncronos. */
  labels?: Record<string, string>
}

const TEMPLATE_VALUE_KEYS = [
  'categoryId',
  'subcategoryId',
  'serviceId',
  'priorityId',
  'impactId',
  'urgencyId',
  'severityId',
  'classificationId',
  'departmentId',
  'changeType',
  'changeRisk',
  'implementationPlan',
  'rollbackPlan',
  'testPlan',
  'tags',
] as const

export function sdEmptyDraft(
  type: SdTicketTypeDTO,
  preset: SdCreateTicketPreset = {},
): SdCreateTicketDraft {
  return {
    type,
    templateId: null,
    title: '',
    description: '',
    manualPriority: false,
    values: { ...(preset.values ?? {}) },
    customFields: {},
    participantIds: [],
    parent: preset.parent ?? null,
  }
}

/** Aplica os padrões de um modelo ao rascunho (sobrescreve o que o modelo define). */
export function sdApplyTemplate(
  draft: SdCreateTicketDraft,
  config: SdConfigBootstrapDTO,
  templateId: string | null,
): SdCreateTicketDraft {
  const template = config.templates.find((t) => t.id === templateId)
  if (!template) return { ...draft, templateId: null }
  const d = template.defaults
  const values = { ...draft.values }
  for (const key of TEMPLATE_VALUE_KEYS) {
    if (d[key] !== undefined) values[key] = d[key]
  }
  return {
    ...draft,
    templateId,
    title: d.title && !draft.title.trim() ? d.title : draft.title,
    description:
      d.description && !draft.description ? d.description : draft.description,
    manualPriority: Boolean(d.priorityId) || draft.manualPriority,
    values,
    customFields: { ...draft.customFields, ...(d.customFields ?? {}) },
  }
}

/** Rascunho → corpo do `POST /tickets`. */
export function sdCreatePayload(
  draft: SdCreateTicketDraft,
  config: SdConfigBootstrapDTO,
  preset: SdCreateTicketPreset = {},
): CreateSdTicketInput {
  const v = draft.values
  const pick = (key: string) => {
    const value = v[key]
    return value === undefined || value === null || value === ''
      ? undefined
      : value
  }
  const definitions = sdApplicableCustomFields(config.customFields, 'TICKET', {
    ticketType: draft.type,
    categoryIds: [
      v.categoryId as string,
      v.subcategoryId as string,
      v.serviceId as string,
    ],
  })
  const payload: Record<string, unknown> = {
    type: draft.type,
    title: draft.title.trim(),
    description: draft.description || undefined,
    templateId: draft.templateId ?? undefined,
    phaseId: preset.phaseId,
    parentId: draft.parent?.id,
    customFields: sdCustomFieldPayload(definitions, draft.customFields),
  }
  const common = [
    'impactId',
    'urgencyId',
    'severityId',
    'categoryId',
    'subcategoryId',
    'serviceId',
    'classificationId',
    'customerId',
    'companyId',
    'contactId',
    'configItemId',
    'departmentId',
    'assigneeId',
    'requesterId',
  ]
  for (const key of common) payload[key] = pick(key)
  if (draft.manualPriority) payload.priorityId = pick('priorityId')
  const tags = v.tags
  if (Array.isArray(tags) && tags.length > 0) payload.tags = tags
  if (draft.type === 'CHANGE') {
    for (const key of [
      'changeType',
      'changeRisk',
      'plannedStartAt',
      'plannedEndAt',
      'implementationPlan',
      'rollbackPlan',
      'testPlan',
    ]) {
      payload[key] = pick(key)
    }
  }
  if (draft.type === 'PROBLEM') {
    payload.rootCause = pick('rootCause')
    payload.workaround = pick('workaround')
    if (v.knownError === true) payload.knownError = true
  }
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key]
  }
  return payload as unknown as CreateSdTicketInput
}

function Row({
  label,
  htmlFor,
  children,
  className,
  required,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
  className?: string
  required?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} className='text-xs'>
        {label}
        {required ? (
          <span className='text-destructive' aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='flex flex-col gap-3'>
      <h3 className='font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
        {title}
      </h3>
      <div className='grid gap-3 sm:grid-cols-2'>{children}</div>
    </section>
  )
}

/**
 * Abertura de chamado (agente): tipo, modelo, título, descrição rica,
 * impacto × urgência com a prioridade da matriz ao vivo (ou manual),
 * catálogo em cascata, classificação, cliente/empresa/contato/CI,
 * departamento, responsável, participantes, tags, item pai, campos
 * customizados e os campos de Mudança/Problema.
 */
export function SdCreateTicketSheet({
  workspaceId,
  slug,
  open,
  onOpenChange,
  defaultType,
  preset,
  onCreated,
}: {
  workspaceId: string
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultType: SdTicketTypeDTO
  preset?: SdCreateTicketPreset
  /** Sem ele, navega para o chamado criado. */
  onCreated?: (ticket: SdTicketDTO) => void
}) {
  const router = useRouter()
  const config = useSdConfig(workspaceId)
  const agents = useSdAgents(workspaceId, { includeRequesters: true })
  const create = useCreateSdTicket(workspaceId)
  const [draft, setDraft] = useState(() =>
    sdEmptyDraft(preset?.type ?? defaultType, preset),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(sdEmptyDraft(preset?.type ?? defaultType, preset))
      setErrors({})
    }
  }

  const cfg = config.data
  const v = draft.values
  const setValue = (key: string, value: unknown) =>
    setDraft((current) => {
      const values = { ...current.values, [key]: value }
      if (key === 'categoryId') {
        values.subcategoryId = null
        values.serviceId = null
      }
      if (key === 'subcategoryId') values.serviceId = null
      return { ...current, values }
    })

  const matrixPriorityId = cfg
    ? sdMatrixPriority(
        cfg.priorityMatrix,
        v.impactId as string | null,
        v.urgencyId as string | null,
      )
    : null
  const matrixPriority =
    cfg?.priorities.find((p) => p.id === matrixPriorityId) ?? null

  const definitions = cfg
    ? sdApplicableCustomFields(cfg.customFields, 'TICKET', {
        ticketType: draft.type,
        categoryIds: [
          v.categoryId as string,
          v.subcategoryId as string,
          v.serviceId as string,
        ],
      })
    : []
  const customValues = sdCustomFieldDefaults(definitions, draft.customFields)
  const templates = (cfg?.templates ?? []).filter(
    (t) => t.active && t.ticketType === draft.type,
  )
  const context = {
    type: draft.type,
    categoryId: v.categoryId as string | null,
    subcategoryId: v.subcategoryId as string | null,
    customerId: v.customerId as string | null,
    companyId: v.companyId as string | null,
  }

  async function submit() {
    if (!cfg) return
    const next: Record<string, string> = {}
    if (!draft.title.trim()) next.title = 'Título é obrigatório'
    Object.assign(next, sdCustomFieldRequiredErrors(definitions, customValues))
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setBusy(true)
    try {
      const ticket = await create.mutateAsync(
        sdCreatePayload({ ...draft, customFields: customValues }, cfg, preset),
      )
      if (draft.participantIds.length > 0) {
        await addSdTicketParticipants(
          workspaceId,
          ticket.id,
          draft.participantIds,
        ).catch((e) => notify.error(e))
      }
      notify.success(`Chamado ${ticket.code} aberto.`)
      onOpenChange(false)
      if (onCreated) onCreated(ticket)
      else router.push(sdTicketHref(slug, ticket))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao abrir'
      const field = definitions.find((d) => message.startsWith(d.label))
      if (field) setErrors({ [field.key]: message })
      else notify.error(message)
    } finally {
      setBusy(false)
    }
  }

  function control(field: string, label: string, className?: string) {
    const id = `sd-new-${field}`
    return (
      <Row label={label} htmlFor={id} className={className}>
        {cfg ? (
          <SdTicketFieldControl
            id={id}
            workspaceId={workspaceId}
            config={cfg}
            field={field}
            context={context}
            agents={agents.data}
            value={v[field]}
            selectedLabel={preset?.labels?.[field]}
            onChange={(value) => setValue(field, value)}
          />
        ) : null}
      </Row>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-3xl'>
        <SheetHeader className='border-b px-6 py-4'>
          <SheetTitle>Novo chamado</SheetTitle>
          <SheetDescription>
            A prioridade vem da matriz impacto × urgência; o SLA e o roteamento
            são aplicados na abertura.
          </SheetDescription>
        </SheetHeader>

        <form
          id='sd-create-ticket'
          className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5'
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void submit()
            }
          }}
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className='flex flex-col gap-3'>
            <fieldset
              aria-label='Tipo do chamado'
              className='grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4'
            >
              {SD_TICKET_TYPES.map((type) => (
                <button
                  key={type}
                  type='button'
                  aria-pressed={draft.type === type}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      type,
                      templateId: null,
                      values: {
                        ...current.values,
                        categoryId: null,
                        subcategoryId: null,
                        serviceId: null,
                        classificationId: null,
                      },
                    }))
                  }
                  className={cn(
                    'rounded-md px-2 py-1.5 font-medium text-sm transition-colors',
                    draft.type === type
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {SD_TICKET_TYPE_LABEL[type]}
                </button>
              ))}
            </fieldset>
            {templates.length > 0 ? (
              <Row label='Modelo' htmlFor='sd-new-template'>
                <SdOptionSelect
                  id='sd-new-template'
                  aria-label='Modelo'
                  value={draft.templateId}
                  noneLabel='Sem modelo'
                  placeholder='Sem modelo'
                  options={templates.map((t) => ({
                    value: t.id,
                    label: t.name,
                  }))}
                  onChange={(id) =>
                    cfg &&
                    setDraft((current) => sdApplyTemplate(current, cfg, id))
                  }
                />
              </Row>
            ) : null}
            <Row label='Título' htmlFor='sd-new-title' required>
              <Input
                id='sd-new-title'
                autoFocus
                maxLength={200}
                aria-invalid={Boolean(errors.title) || undefined}
                value={draft.title}
                onChange={(e) =>
                  setDraft((current) => ({ ...current, title: e.target.value }))
                }
                placeholder='Resumo do chamado'
              />
              {errors.title ? (
                <p className='text-destructive text-xs' role='alert'>
                  {errors.title}
                </p>
              ) : null}
            </Row>
            <Row label='Descrição'>
              <SdRichTextEditor
                key={`${draft.type}:${draft.templateId ?? ''}:${open}`}
                value={draft.description}
                onChange={(html) =>
                  setDraft((current) => ({ ...current, description: html }))
                }
              />
            </Row>
            {/* KCS: antes de abrir, mostra o que a base já responde. */}
            <SdKbDraftSuggestions
              workspaceId={workspaceId}
              workspaceSlug={slug}
              title={draft.title}
              description={draft.description}
              categoryIds={[
                v.categoryId as string | null,
                v.subcategoryId as string | null,
                v.serviceId as string | null,
              ].filter((id): id is string => Boolean(id))}
            />
          </div>

          <Section title='Prioridade'>
            {control('impactId', 'Impacto')}
            {control('urgencyId', 'Urgência')}
            <div className='flex flex-col gap-2 sm:col-span-2'>
              <div className='flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm'>
                <span className='text-muted-foreground'>
                  Prioridade pela matriz:
                </span>
                {matrixPriority ? (
                  <SdLevelBadge
                    level={{
                      id: matrixPriority.id,
                      name: matrixPriority.name,
                      level: matrixPriority.level,
                      color: matrixPriority.color,
                    }}
                  />
                ) : (
                  <span className='text-muted-foreground text-xs italic'>
                    informe impacto e urgência
                  </span>
                )}
                {/* biome-ignore lint/a11y/noLabelWithoutControl: o Switch é o controle */}
                <label className='ml-auto flex items-center gap-2 text-xs'>
                  <Switch
                    checked={draft.manualPriority}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        manualPriority: Boolean(checked),
                      }))
                    }
                  />
                  Definir manualmente
                </label>
              </div>
            </div>
            {draft.manualPriority ? control('priorityId', 'Prioridade') : null}
            {control('severityId', 'Severidade')}
          </Section>

          <Section title='Catálogo'>
            {control('categoryId', 'Categoria')}
            {control('subcategoryId', 'Subcategoria')}
            {control('serviceId', 'Serviço')}
            {control('classificationId', 'Classificação')}
          </Section>

          <Section title='Cliente'>
            {control('customerId', 'Cliente')}
            {control('companyId', 'Empresa')}
            {control('contactId', 'Contato')}
            {control('configItemId', 'Item de configuração')}
          </Section>

          <Section title='Atendimento'>
            {control('departmentId', 'Departamento')}
            {control('assigneeId', 'Responsável')}
            {control('requesterId', 'Solicitante')}
            <Row label='Participantes'>
              <SdMultiSelect
                label='Participantes'
                placeholder='Nenhum'
                value={draft.participantIds}
                onChange={(ids) =>
                  setDraft((current) => ({ ...current, participantIds: ids }))
                }
                options={(agents.data ?? []).map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
              />
            </Row>
            <Row label='Item pai'>
              <SdTicketPicker
                workspaceId={workspaceId}
                value={draft.parent?.id ?? null}
                selectedLabel={draft.parent?.label}
                onChange={(option) =>
                  setDraft((current) => ({
                    ...current,
                    parent: option
                      ? { id: option.id, label: option.label }
                      : null,
                  }))
                }
              />
            </Row>
            {control('tags', 'Tags')}
          </Section>

          {draft.type === 'CHANGE' ? (
            <Section title='Mudança'>
              {control('changeType', 'Tipo de mudança')}
              {control('changeRisk', 'Risco')}
              {control('plannedStartAt', 'Início planejado')}
              {control('plannedEndAt', 'Fim planejado')}
              {control(
                'implementationPlan',
                'Plano de implantação',
                'sm:col-span-2',
              )}
              {control('rollbackPlan', 'Plano de retorno', 'sm:col-span-2')}
              {control('testPlan', 'Plano de testes', 'sm:col-span-2')}
            </Section>
          ) : null}

          {draft.type === 'PROBLEM' ? (
            <Section title='Problema'>
              {control('rootCause', 'Causa raiz', 'sm:col-span-2')}
              {control('workaround', 'Solução de contorno', 'sm:col-span-2')}
              {control('knownError', 'Erro conhecido')}
            </Section>
          ) : null}

          {definitions.length > 0 ? (
            <section className='flex flex-col gap-3'>
              <h3 className='font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
                Campos customizados
              </h3>
              <SdCustomFieldsForm
                workspaceId={workspaceId}
                definitions={definitions}
                values={customValues}
                errors={errors}
                idPrefix='sd-new-cf'
                onChange={(customFields) =>
                  setDraft((current) => ({ ...current, customFields }))
                }
              />
            </section>
          ) : null}
        </form>

        <SheetFooter className='flex-row items-center justify-end gap-2 border-t px-6 py-4'>
          <span className='mr-auto hidden text-muted-foreground text-xs sm:inline'>
            <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> para abrir
          </span>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='submit' form='sd-create-ticket' disabled={busy || !cfg}>
            {busy ? 'Abrindo…' : 'Abrir chamado'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
