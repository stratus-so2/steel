'use client'

import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRef } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  type FieldSpec,
  type ImageField as ImageFieldSpec,
  type ItemsField,
  type ScalarField,
  SECTION_FIELDS,
} from '@/src/lib/crm-email-builder/fields'
import type { EmailBuilderSection } from '@/src/schemas/crm-email-builder.schema'
import { ImageField } from './image-field'
import { LinkField } from './link-field'
import { RichTextField } from './rich-text-field'
import { insertAtCaret, VariablePicker } from './variable-picker'

type Values = Record<string, unknown>
type Change = (patch: Values, group: string) => void

function ScalarInput({
  id,
  field,
  value,
  workspaceId,
  onChange,
}: {
  id: string
  field: ScalarField
  value: string
  workspaceId: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  if (field.kind === 'richtext') {
    return <RichTextField id={id} value={value} onChange={onChange} />
  }
  if (field.kind === 'link') {
    return (
      <LinkField
        id={id}
        workspaceId={workspaceId}
        value={value}
        onChange={onChange}
      />
    )
  }
  const common = {
    id,
    ref,
    value,
    maxLength: field.max,
    placeholder: field.placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
  }
  return (
    <div className='flex min-w-0 items-start gap-1'>
      {field.kind === 'textarea' ? (
        <Textarea {...common} rows={3} className='min-w-0 flex-1' />
      ) : (
        <Input {...common} className='min-w-0 flex-1' />
      )}
      <VariablePicker
        onPick={(token) => onChange(insertAtCaret(ref.current, value, token))}
      />
    </div>
  )
}

function FieldControl({
  idPrefix,
  field,
  values,
  workspaceId,
  onChange,
}: {
  idPrefix: string
  field: ScalarField | ImageFieldSpec
  values: Values
  workspaceId: string
  onChange: Change
}) {
  const id = `${idPrefix}-${field.key}`
  if (field.kind === 'image') {
    return (
      <ImageField
        id={id}
        workspaceId={workspaceId}
        label={field.label}
        src={String(values[field.key] ?? '')}
        alt={String(values[field.altKey] ?? '')}
        onChange={(next) =>
          onChange(
            {
              ...(next.src !== undefined ? { [field.key]: next.src } : {}),
              ...(next.alt !== undefined ? { [field.altKey]: next.alt } : {}),
            },
            id,
          )
        }
      />
    )
  }
  return (
    <div className='grid min-w-0 gap-1.5'>
      <Label htmlFor={id} className='text-muted-foreground text-xs'>
        {field.label}
      </Label>
      <ScalarInput
        id={id}
        field={field}
        value={String(values[field.key] ?? '')}
        workspaceId={workspaceId}
        onChange={(value) => onChange({ [field.key]: value }, id)}
      />
    </div>
  )
}

function ItemsEditor({
  idPrefix,
  field,
  items,
  workspaceId,
  onChange,
}: {
  idPrefix: string
  field: ItemsField
  items: Values[]
  workspaceId: string
  onChange: (items: Values[], group: string) => void
}) {
  const update = (index: number, patch: Values, group: string) =>
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      group,
    )
  const move = (index: number, direction: -1 | 1) => {
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(index + direction, 0, moved)
    onChange(next, `${idPrefix}-move`)
  }

  return (
    <div className='grid gap-3 sm:col-span-2'>
      <div className='flex items-center justify-between gap-2'>
        <span className='font-medium text-sm'>{field.label}</span>
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={items.length >= field.max}
          onClick={() =>
            onChange(
              [...items, field.createItem() as Values],
              `${idPrefix}-add`,
            )
          }
        >
          <SteelIcon icon={Add01Icon} strokeWidth={2} />
          Adicionar {field.itemLabel.toLowerCase()}
        </Button>
      </div>
      {items.map((item, index) => (
        <fieldset
          key={index}
          className='grid min-w-0 gap-3 rounded-lg border border-border p-3 sm:grid-cols-2'
        >
          <legend className='sr-only'>
            {field.itemLabel} {index + 1}
          </legend>
          <div className='flex items-center justify-between gap-2 sm:col-span-2'>
            <span className='text-muted-foreground text-xs'>
              {field.itemLabel} {index + 1}
            </span>
            <div className='flex items-center gap-0.5'>
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                aria-label={`Mover ${field.itemLabel.toLowerCase()} ${index + 1} para cima`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <SteelIcon icon={ArrowUp01Icon} strokeWidth={2} />
              </Button>
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                aria-label={`Mover ${field.itemLabel.toLowerCase()} ${index + 1} para baixo`}
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
              </Button>
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                aria-label={`Remover ${field.itemLabel.toLowerCase()} ${index + 1}`}
                disabled={items.length <= field.min}
                onClick={() =>
                  onChange(
                    items.filter((_, i) => i !== index),
                    `${idPrefix}-remove`,
                  )
                }
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </div>
          </div>
          {field.fields.map((sub) => (
            <div
              key={sub.key}
              className={sub.kind === 'image' ? 'sm:col-span-2' : undefined}
            >
              <FieldControl
                idPrefix={`${idPrefix}-${index}`}
                field={sub}
                values={item}
                workspaceId={workspaceId}
                onChange={(patch, group) => update(index, patch, group)}
              />
            </div>
          ))}
        </fieldset>
      ))}
    </div>
  )
}

const WIDE: FieldSpec['kind'][] = ['richtext', 'image', 'items', 'textarea']

/** Content fields of one section, generated from `SECTION_FIELDS`. */
export function SectionFields({
  section,
  workspaceId,
  onChange,
}: {
  section: EmailBuilderSection
  workspaceId: string
  onChange: (props: Values, group: string) => void
}) {
  const fields = SECTION_FIELDS[section.type]
  const values = section.props as Values
  const idPrefix = `field-${section.id}`

  if (fields.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>
        O cabeçalho usa o logo e o nome da marca — edite na aba Marca.
      </p>
    )
  }

  return (
    <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
      {fields.map((field) =>
        field.kind === 'items' ? (
          <ItemsEditor
            key={field.key}
            idPrefix={idPrefix}
            field={field}
            items={(values.items as Values[]) ?? []}
            workspaceId={workspaceId}
            onChange={(items, group) => onChange({ ...values, items }, group)}
          />
        ) : (
          <div
            key={field.key}
            className={WIDE.includes(field.kind) ? 'sm:col-span-2' : undefined}
          >
            <FieldControl
              idPrefix={idPrefix}
              field={field}
              values={values}
              workspaceId={workspaceId}
              onChange={(patch, group) =>
                onChange({ ...values, ...patch }, group)
              }
            />
          </div>
        ),
      )}
      {section.type === 'footer' ? (
        <p className='text-muted-foreground text-xs sm:col-span-2'>
          O link de descadastro (LGPD) é obrigatório e sempre aparece no rodapé,
          com o endereço da marca.
        </p>
      ) : null}
    </div>
  )
}
