'use client'

import type { CrmProposalSectionContent } from '@/src/schemas/crm-proposal.schema'
import { ListItemsEditor } from './list-items-editor'

export type ClientNeedsContent = Extract<
  CrmProposalSectionContent,
  { type: 'CLIENT_NEEDS' }
>

export function clientNeedsDefaultContent(): ClientNeedsContent {
  return {
    type: 'CLIENT_NEEDS',
    items: [{ title: 'Necessidade identificada', description: '' }],
  }
}

export function ClientNeedsEditor({
  content,
  onChange,
}: {
  content: ClientNeedsContent
  onChange: (content: ClientNeedsContent) => void
}) {
  return (
    <ListItemsEditor
      items={content.items}
      onChange={(items) => onChange({ ...content, items })}
      addLabel='Adicionar necessidade'
      itemPlaceholder='Necessidade do cliente'
    />
  )
}

export function ClientNeedsDisplay({
  content,
}: {
  content: ClientNeedsContent
}) {
  return (
    <section className='flex flex-col gap-4 rounded-lg border p-8'>
      <h2 className='font-semibold text-2xl'>Necessidade do cliente</h2>
      <ul className='flex flex-col gap-3'>
        {content.items.map((item) => (
          <li key={item.title} className='rounded-md bg-muted/40 p-3'>
            <p className='font-medium'>{item.title}</p>
            {item.description ? (
              <p className='whitespace-pre-wrap text-muted-foreground text-sm'>
                {item.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
