'use client'

import {
  SdConfigItemPicker,
  SdContactPicker,
  SdCustomerPicker,
} from '@/app/_components/servicedesk/pickers'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { SdAgentDTO, SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import { SdCustomFieldInput } from '../custom-fields/sd-custom-fields-form'
import { SdKbTagsInput } from '../knowledge/sd-kb-tags-input'
import { SdOptionSelect } from './sd-option-select'
import {
  SD_CHANGE_TYPE_LABEL,
  SD_RISK_LABEL,
  sdFromLocalInput,
  sdToLocalInput,
} from './sd-ticket-meta'
import {
  sdCategoryChildOptions,
  sdCategoryOptions,
  sdClassificationOptions,
  sdDepartmentOptions,
  sdScaleOptions,
} from './sd-ticket-options'

/** Contexto do chamado que muda as opções (tipo, catálogo, cliente). */
export interface SdFieldContext {
  type: SdTicketTypeDTO
  categoryId?: string | null
  subcategoryId?: string | null
  customerId?: string | null
  companyId?: string | null
}

export interface SdTicketFieldControlProps {
  workspaceId: string
  config: SdConfigBootstrapDTO
  field: string
  context: SdFieldContext
  value: unknown
  /** Rótulo já conhecido (clientes, contatos, CI). */
  selectedLabel?: string | null
  /** Seleção: salva na hora. Texto: atualiza o rascunho. */
  onChange: (value: unknown) => void
  /** Texto: salvar ao sair do campo. */
  onCommit?: () => void
  agents?: SdAgentDTO[]
  disabled?: boolean
  invalid?: boolean
  id?: string
}

/** Campos de texto longo (salvam ao sair). */
export const SD_TEXT_FIELDS = new Set([
  'description',
  'solution',
  'implementationPlan',
  'rollbackPlan',
  'testPlan',
  'rootCause',
  'workaround',
])

/** Campos cujo editor salva a cada tecla/blur (não na seleção). */
export function sdIsDraftField(
  field: string,
  config?: SdConfigBootstrapDTO,
): boolean {
  if (SD_TEXT_FIELDS.has(field) || field === 'title') return true
  if (field === 'plannedStartAt' || field === 'plannedEndAt') return true
  if (field.startsWith('customFields.')) {
    const def = config?.customFields.find(
      (d) => d.entity === 'TICKET' && d.key === field.slice(13),
    )
    return Boolean(
      def &&
        [
          'TEXT',
          'TEXTAREA',
          'NUMBER',
          'CURRENCY',
          'DATE',
          'DATETIME',
          'EMAIL',
          'URL',
          'PHONE',
        ].includes(def.type),
    )
  }
  return false
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/**
 * Editor de um campo do chamado por chave (`priorityId`, `customerId`,
 * `customFields.<chave>`…). Usado na barra lateral (edição inline), no
 * diálogo de campos obrigatórios da fase e na abertura.
 */
export function SdTicketFieldControl({
  workspaceId,
  config,
  field,
  context,
  value,
  selectedLabel,
  onChange,
  onCommit,
  agents = [],
  disabled,
  invalid,
  id,
}: SdTicketFieldControlProps) {
  const selectProps = {
    id,
    disabled,
    value: str(value),
    onChange: (next: string | null) => onChange(next),
  }

  switch (field) {
    case 'impactId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Impacto'
          options={sdScaleOptions(config.impacts)}
        />
      )
    case 'urgencyId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Urgência'
          options={sdScaleOptions(config.urgencies)}
        />
      )
    case 'priorityId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Prioridade'
          options={sdScaleOptions(config.priorities)}
        />
      )
    case 'severityId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Severidade'
          options={sdScaleOptions(config.severities)}
        />
      )
    case 'categoryId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Categoria'
          noneLabel='Nenhuma'
          options={sdCategoryOptions(
            config.categories,
            context.type,
            str(value),
          )}
        />
      )
    case 'subcategoryId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Subcategoria'
          noneLabel='Nenhuma'
          disabled={disabled || !context.categoryId}
          placeholder={
            context.categoryId ? 'Selecionar…' : 'Escolha a categoria'
          }
          options={sdCategoryChildOptions(
            config.categories,
            context.categoryId,
            context.type,
            str(value),
          )}
        />
      )
    case 'serviceId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Serviço'
          disabled={disabled || !context.subcategoryId}
          placeholder={
            context.subcategoryId ? 'Selecionar…' : 'Escolha a subcategoria'
          }
          options={sdCategoryChildOptions(
            config.categories,
            context.subcategoryId,
            context.type,
            str(value),
          )}
        />
      )
    case 'classificationId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Classificação'
          noneLabel='Nenhuma'
          options={sdClassificationOptions(
            config.classifications,
            'TICKET',
            context.type,
            str(value),
          )}
        />
      )
    case 'solutionClassificationId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Classificação da solução'
          noneLabel='Nenhuma'
          options={sdClassificationOptions(
            config.classifications,
            'SOLUTION',
            context.type,
            str(value),
          )}
        />
      )
    case 'departmentId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Departamento'
          options={sdDepartmentOptions(config.departments, str(value))}
        />
      )
    case 'assigneeId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Responsável'
          noneLabel='Não atribuído'
          placeholder='Não atribuído'
          options={agents
            .filter((a) => a.isAgent || a.id === value)
            .map((a) => ({ value: a.id, label: a.name }))}
        />
      )
    case 'requesterId':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Solicitante'
          options={agents.map((a) => ({ value: a.id, label: a.name }))}
        />
      )
    case 'customerId':
      return (
        <SdCustomerPicker
          workspaceId={workspaceId}
          kind='CLIENT'
          id={id}
          disabled={disabled}
          value={str(value)}
          selectedLabel={selectedLabel}
          onChange={(option) => onChange(option?.id ?? null)}
        />
      )
    case 'companyId':
      return (
        <SdCustomerPicker
          workspaceId={workspaceId}
          kind='COMPANY'
          id={id}
          disabled={disabled}
          value={str(value)}
          selectedLabel={selectedLabel}
          onChange={(option) => onChange(option?.id ?? null)}
        />
      )
    case 'contactId':
      return (
        <SdContactPicker
          workspaceId={workspaceId}
          customerId={context.customerId ?? context.companyId}
          id={id}
          disabled={disabled}
          value={str(value)}
          selectedLabel={selectedLabel}
          onChange={(option) => onChange(option?.id ?? null)}
        />
      )
    case 'configItemId':
      return (
        <SdConfigItemPicker
          workspaceId={workspaceId}
          customerId={context.customerId ?? context.companyId}
          id={id}
          disabled={disabled}
          value={str(value)}
          selectedLabel={selectedLabel}
          onChange={(option) => onChange(option?.id ?? null)}
        />
      )
    case 'changeType':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Tipo de mudança'
          options={Object.entries(SD_CHANGE_TYPE_LABEL).map(([v, label]) => ({
            value: v,
            label,
          }))}
        />
      )
    case 'changeRisk':
      return (
        <SdOptionSelect
          {...selectProps}
          aria-label='Risco'
          options={Object.entries(SD_RISK_LABEL).map(([v, label]) => ({
            value: v,
            label,
          }))}
        />
      )
    case 'plannedStartAt':
    case 'plannedEndAt':
      return (
        <Input
          id={id}
          type='datetime-local'
          disabled={disabled}
          aria-invalid={invalid || undefined}
          value={sdToLocalInput(str(value))}
          onChange={(e) => onChange(sdFromLocalInput(e.target.value))}
          onBlur={onCommit}
          className='h-8'
        />
      )
    case 'knownError':
      return (
        <div className='flex h-8 items-center'>
          <Switch
            id={id}
            disabled={disabled}
            checked={value === true}
            aria-label='Erro conhecido'
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
        </div>
      )
    case 'tags':
      return (
        <div className='min-h-8 rounded-md border px-2 py-1'>
          <SdKbTagsInput
            value={Array.isArray(value) ? (value as string[]) : []}
            onChange={(tags) => onChange(tags)}
            disabled={disabled}
          />
        </div>
      )
    case 'title':
      return (
        <Input
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          className='h-8'
        />
      )
    default:
      break
  }

  if (field.startsWith('customFields.')) {
    const definition = config.customFields.find(
      (d) => d.entity === 'TICKET' && d.key === field.slice(13),
    )
    if (!definition) return null
    return (
      <SdCustomFieldInput
        id={id}
        definition={definition}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        agents={agents}
        disabled={disabled}
        invalid={invalid}
      />
    )
  }

  if (SD_TEXT_FIELDS.has(field)) {
    return (
      <Textarea
        id={id}
        rows={3}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className='min-h-16 text-sm'
      />
    )
  }
  return null
}
