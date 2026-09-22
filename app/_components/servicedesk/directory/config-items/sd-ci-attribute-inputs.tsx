'use client'

import { SdField } from '@/app/_components/servicedesk/directory/shared/sd-form-bits'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { SdCiAttributeDefinitionDTO } from '@/types/sd-config-item'

export type SdCiAttributeFormValues = Record<string, string | boolean>

/** Campos gerados a partir do `attributeSchema` do tipo do CI. */
export function SdCiAttributeInputs({
  schema,
  values,
  onChange,
}: {
  schema: SdCiAttributeDefinitionDTO[]
  values: SdCiAttributeFormValues
  onChange: (next: SdCiAttributeFormValues) => void
}) {
  if (schema.length === 0) {
    return (
      <p className='text-muted-foreground text-sm sm:col-span-2'>
        Este tipo não tem atributos específicos.
      </p>
    )
  }
  return (
    <>
      {schema.map((def) => {
        const id = `sd-ci-attr-${def.key}`
        const label = def.required ? `${def.label} *` : def.label
        const value = values[def.key]
        const set = (v: string | boolean) =>
          onChange({ ...values, [def.key]: v })
        if (def.type === 'boolean') {
          return (
            // biome-ignore lint/a11y/noLabelWithoutControl: o Switch é o controle envolvido
            <label key={def.key} className='flex items-center gap-2 text-sm'>
              <Switch
                checked={value === true}
                onCheckedChange={(checked) => set(Boolean(checked))}
              />
              {label}
            </label>
          )
        }
        if (def.type === 'select') {
          const current = typeof value === 'string' ? value : ''
          return (
            <SdField key={def.key} label={label}>
              <Select
                value={current || '__none'}
                onValueChange={(v) => set(v === '__none' ? '' : String(v))}
              >
                <SelectTrigger className='w-full'>
                  <span>{current || '—'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none'>—</SelectItem>
                  {(def.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SdField>
          )
        }
        return (
          <SdField key={def.key} label={label} htmlFor={id}>
            <Input
              id={id}
              type={
                def.type === 'number'
                  ? 'number'
                  : def.type === 'date'
                    ? 'date'
                    : 'text'
              }
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => set(e.target.value)}
            />
          </SdField>
        )
      })}
    </>
  )
}

/** Valores salvos → estado do formulário (tudo string/boolean). */
export function toAttributeFormValues(
  attributes: Record<string, string | number | boolean>,
): SdCiAttributeFormValues {
  const out: SdCiAttributeFormValues = {}
  for (const [key, value] of Object.entries(attributes)) {
    out[key] = typeof value === 'boolean' ? value : String(value)
  }
  return out
}

/** Estado do formulário → corpo da API (vazios viram `null`). */
export function fromAttributeFormValues(
  schema: SdCiAttributeDefinitionDTO[],
  values: SdCiAttributeFormValues,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  for (const def of schema) {
    const value = values[def.key]
    if (value === undefined || value === '') continue
    if (def.type === 'number' && typeof value === 'string') {
      out[def.key] = Number(value.replace(',', '.'))
    } else {
      out[def.key] = value
    }
  }
  return out
}
