'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSdAgents, useSdConfig } from '@/src/hooks/use-sd-config'
import type {
  SdAgentDTO,
  SdCustomFieldDefinitionDTO,
  SdCustomFieldEntityDTO,
} from '@/types/sd-config'
import { SdOptionSelect } from '../ticket/sd-option-select'
import { sdFromLocalInput, sdToLocalInput } from '../ticket/sd-ticket-meta'
import {
  type SdCustomFieldContext,
  sdApplicableCustomFields,
  sdFormatCustomFieldValue,
} from './sd-custom-fields-utils'

/**
 * Formulário e visualização dos campos customizados do ServiceDesk
 * (chamado, cliente, contato, CI). Renderiza todos os `SdCustomFieldType`,
 * marca obrigatórios e mostra o erro de cada campo.
 */

export interface SdCustomFieldInputProps {
  definition: SdCustomFieldDefinitionDTO
  value: unknown
  onChange: (value: unknown) => void
  agents?: SdAgentDTO[]
  disabled?: boolean
  invalid?: boolean
  id?: string
  /** Salva ao sair do campo (edição inline). */
  onCommit?: () => void
}

function asString(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

/** Um campo customizado (sem rótulo). */
export function SdCustomFieldInput({
  definition,
  value,
  onChange,
  agents = [],
  disabled,
  invalid,
  id,
  onCommit,
}: SdCustomFieldInputProps) {
  const common = {
    id,
    disabled,
    'aria-invalid': invalid || undefined,
    onBlur: onCommit,
  }
  switch (definition.type) {
    case 'TEXTAREA':
      return (
        <Textarea
          {...common}
          rows={3}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'NUMBER':
      return (
        <Input
          {...common}
          type='number'
          inputMode='decimal'
          value={asString(value)}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
        />
      )
    case 'CURRENCY':
      return (
        <div className='relative'>
          <span className='-translate-y-1/2 absolute top-1/2 left-2.5 text-muted-foreground text-sm'>
            R$
          </span>
          <Input
            {...common}
            type='number'
            inputMode='decimal'
            step='0.01'
            className='pl-9'
            value={asString(value)}
            onChange={(e) =>
              onChange(e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </div>
      )
    case 'DATE':
      return (
        <Input
          {...common}
          type='date'
          value={asString(value).slice(0, 10)}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    case 'DATETIME':
      return (
        <Input
          {...common}
          type='datetime-local'
          value={sdToLocalInput(asString(value) || null)}
          onChange={(e) => onChange(sdFromLocalInput(e.target.value))}
        />
      )
    case 'CHECKBOX':
      return (
        <div className='flex h-8 items-center'>
          <Checkbox
            id={id}
            disabled={disabled}
            checked={value === true}
            aria-label={definition.label}
            onCheckedChange={(checked) => {
              onChange(Boolean(checked))
              onCommit?.()
            }}
          />
        </div>
      )
    case 'SELECT':
      return (
        <SdOptionSelect
          id={id}
          aria-label={definition.label}
          disabled={disabled}
          value={typeof value === 'string' ? value : null}
          onChange={(next) => {
            onChange(next)
            onCommit?.()
          }}
          options={definition.options.map((o) => ({
            value: o.value,
            label: o.label,
            color: o.color,
          }))}
          noneLabel='—'
          allowClear={!definition.required}
        />
      )
    case 'MULTI_SELECT': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <fieldset
          aria-label={definition.label}
          className='flex flex-wrap gap-1.5'
          disabled={disabled}
        >
          {definition.options.map((o) => {
            const active = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type='button'
                aria-pressed={active}
                onClick={() => {
                  onChange(
                    active
                      ? selected.filter((v) => v !== o.value)
                      : [...selected, o.value],
                  )
                  onCommit?.()
                }}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {o.color ? (
                  <span
                    className='size-2 rounded-full'
                    style={{ backgroundColor: o.color }}
                  />
                ) : null}
                {o.label}
              </button>
            )
          })}
          {definition.options.length === 0 ? (
            <span className='text-muted-foreground text-xs'>Sem opções</span>
          ) : null}
        </fieldset>
      )
    }
    case 'USER':
      return (
        <SdOptionSelect
          id={id}
          aria-label={definition.label}
          disabled={disabled}
          value={typeof value === 'string' ? value : null}
          onChange={(next) => {
            onChange(next)
            onCommit?.()
          }}
          options={agents.map((a) => ({ value: a.id, label: a.name }))}
          placeholder='Selecionar usuário…'
          noneLabel='—'
        />
      )
    default:
      return (
        <Input
          {...common}
          type={
            definition.type === 'EMAIL'
              ? 'email'
              : definition.type === 'URL'
                ? 'url'
                : definition.type === 'PHONE'
                  ? 'tel'
                  : 'text'
          }
          placeholder={
            definition.type === 'URL'
              ? 'https://'
              : definition.type === 'PHONE'
                ? '(11) 99999-9999'
                : undefined
          }
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

export interface SdCustomFieldsFormProps {
  workspaceId: string
  /** Definições já filtradas (ver `sdApplicableCustomFields`). */
  definitions: SdCustomFieldDefinitionDTO[]
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
  errors?: Record<string, string>
  disabled?: boolean
  columns?: 1 | 2
  idPrefix?: string
}

/** Grade de campos customizados com rótulo, obrigatório e erro. */
export function SdCustomFieldsForm({
  workspaceId,
  definitions,
  values,
  onChange,
  errors = {},
  disabled,
  columns = 2,
  idPrefix = 'sd-cf',
}: SdCustomFieldsFormProps) {
  const needsAgents = definitions.some((d) => d.type === 'USER')
  const agents = useSdAgents(workspaceId, {
    includeRequesters: true,
    enabled: needsAgents,
  })
  if (definitions.length === 0) return null
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
      )}
    >
      {definitions.map((d) => {
        const id = `${idPrefix}-${d.key}`
        const error = errors[d.key]
        const wide = d.type === 'TEXTAREA' || d.type === 'MULTI_SELECT'
        return (
          <div
            key={d.id}
            className={cn(
              'flex min-w-0 flex-col gap-1.5',
              wide && columns === 2 && 'sm:col-span-2',
            )}
          >
            <Label htmlFor={id} className='text-xs'>
              {d.label}
              {d.required ? (
                <span className='text-destructive' aria-hidden>
                  *
                </span>
              ) : null}
            </Label>
            <SdCustomFieldInput
              id={id}
              definition={d}
              value={values[d.key]}
              agents={agents.data}
              disabled={disabled}
              invalid={Boolean(error)}
              onChange={(value) => onChange({ ...values, [d.key]: value })}
            />
            {d.description && !error ? (
              <p className='text-muted-foreground text-xs'>{d.description}</p>
            ) : null}
            {error ? (
              <p className='text-destructive text-xs' role='alert'>
                {error}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Campos customizados de uma entidade carregando as definições da
 * configuração (`useSdConfig`). Uso nos cadastros.
 */
export function SdEntityCustomFieldsForm({
  workspaceId,
  entity,
  context,
  ...props
}: Omit<SdCustomFieldsFormProps, 'definitions'> & {
  entity: SdCustomFieldEntityDTO
  context?: SdCustomFieldContext
}) {
  const config = useSdConfig(workspaceId)
  const definitions = sdApplicableCustomFields(
    config.data?.customFields ?? [],
    entity,
    context,
  )
  if (definitions.length === 0) return null
  return (
    <section className='flex flex-col gap-3'>
      <h3 className='font-semibold text-sm'>Campos customizados</h3>
      <SdCustomFieldsForm
        workspaceId={workspaceId}
        definitions={definitions}
        {...props}
      />
    </section>
  )
}

/**
 * Valores dos campos customizados (só leitura) com rótulos e formatação
 * das definições; chaves sem definição aparecem com a própria chave.
 */
export function SdCustomFieldsView({
  workspaceId,
  entity,
  values,
  title = 'Campos customizados',
}: {
  workspaceId: string
  entity: SdCustomFieldEntityDTO
  values: Record<string, unknown>
  title?: string | null
}) {
  const config = useSdConfig(workspaceId)
  const definitions = (config.data?.customFields ?? [])
    .filter((d) => d.entity === entity)
    .sort((a, b) => a.position - b.position)
  const needsAgents = definitions.some((d) => d.type === 'USER')
  const agents = useSdAgents(workspaceId, {
    includeRequesters: true,
    enabled: needsAgents,
  })
  const known = new Set(definitions.map((d) => d.key))
  const rows = [
    ...definitions
      .filter((d) => values[d.key] !== undefined && values[d.key] !== null)
      .map((d) => ({
        key: d.key,
        label: d.label,
        text: sdFormatCustomFieldValue(d, values[d.key], agents.data),
      })),
    ...Object.entries(values)
      .filter(([key, value]) => !known.has(key) && value !== null)
      .map(([key, value]) => ({
        key,
        label: key,
        text: Array.isArray(value) ? value.join(', ') : String(value),
      })),
  ]
  if (rows.length === 0) return null
  return (
    <div className='mt-4'>
      {title ? (
        <h4 className='mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
          {title}
        </h4>
      ) : null}
      <dl className='divide-y'>
        {rows.map((row) => (
          <div
            key={row.key}
            className='grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2 text-sm'
          >
            <dt className='truncate text-muted-foreground'>{row.label}</dt>
            <dd className='min-w-0 break-words'>{row.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
