'use client'

import {
  ArrowUpRight01Icon,
  Call02Icon,
  Copy01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import {
  type MetaTemplateButton,
  renderTemplateText,
  type TemplateFillableFields,
} from '@/src/lib/whatsapp/template-variables'

function buttonIcon(type: MetaTemplateButton['type']) {
  if (type === 'URL') return ArrowUpRight01Icon
  if (type === 'PHONE_NUMBER') return Call02Icon
  if (type === 'COPY_CODE') return Copy01Icon
  return undefined
}

export function TemplatePreview({
  fields,
  values,
}: {
  fields: TemplateFillableFields
  values: {
    header: Record<number, string>
    body: Record<number, string>
    buttons: Record<number, string>
  }
}) {
  const bodyText = renderTemplateText(fields.body.text, values.body)
  const headerText =
    fields.header.format === 'TEXT' && fields.header.text
      ? renderTemplateText(fields.header.text, values.header)
      : undefined

  return (
    <div className='rounded-lg bg-[#e5ddd5] p-4 dark:bg-muted'>
      <div className='mx-auto max-w-xs rounded-lg bg-background shadow-sm'>
        <div className='space-y-1.5 rounded-t-lg p-3 text-sm'>
          {fields.header.format && fields.header.format !== 'TEXT' && (
            <div className='flex h-24 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs'>
              {fields.header.format === 'IMAGE' && 'Imagem'}
              {fields.header.format === 'VIDEO' && 'Vídeo'}
              {fields.header.format === 'DOCUMENT' && 'Documento'}
              {fields.header.format === 'LOCATION' && 'Localização'}
            </div>
          )}
          {headerText && <p className='font-semibold'>{headerText}</p>}
          <p className='whitespace-pre-wrap'>{bodyText}</p>
          {fields.footer && (
            <p className='text-muted-foreground text-xs'>
              {fields.footer.text}
            </p>
          )}
        </div>
        {fields.buttons.length > 0 && (
          <div className='divide-y border-t'>
            {fields.buttons.map((button, index) => {
              const icon = buttonIcon(button.type)
              return (
                <div
                  key={`${button.text}-${index}`}
                  className='flex items-center justify-center gap-1.5 py-2 text-primary text-sm'
                >
                  {icon && <SteelIcon icon={icon} size={14} />}
                  {button.text}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
