import type { SdCustomFieldValuesDTO } from '@/types/sd-directory'
import { SdInfoRow } from './sd-form-bits'

function display(value: SdCustomFieldValuesDTO[string]): string {
  if (value === null) return ''
  if (Array.isArray(value)) return value.filter((v) => v !== null).join(', ')
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

/**
 * Valores de campos customizados (só leitura). TODO(servicedesk-integração):
 * usar os rótulos e tipos das definições da fatia config.
 */
export function SdCustomFieldsView({
  values,
}: {
  values: SdCustomFieldValuesDTO
}) {
  const entries = Object.entries(values)
  if (entries.length === 0) return null
  return (
    <div className='mt-4'>
      <h4 className='mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
        Campos customizados
      </h4>
      <dl className='divide-y'>
        {entries.map(([key, value]) => (
          <SdInfoRow key={key} label={key}>
            {display(value)}
          </SdInfoRow>
        ))}
      </dl>
    </div>
  )
}
