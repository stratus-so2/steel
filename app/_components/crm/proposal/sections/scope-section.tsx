'use client'

import type { CrmProposalSectionContent } from '@/src/schemas/crm-proposal.schema'
import { ListItemsEditor } from './list-items-editor'

export type ScopeContent = Extract<CrmProposalSectionContent, { type: 'SCOPE' }>

export function scopeDefaultContent(): ScopeContent {
  return {
    type: 'SCOPE',
    items: [{ title: 'Item do escopo', description: '' }],
  }
}

export function ScopeEditor({
  content,
  onChange,
}: {
  content: ScopeContent
  onChange: (content: ScopeContent) => void
}) {
  return (
    <ListItemsEditor
      items={content.items}
      onChange={(items) => onChange({ ...content, items })}
      addLabel='Adicionar item'
      itemPlaceholder='Item do escopo'
    />
  )
}

export function ScopeDisplay({ content }: { content: ScopeContent }) {
  return (
    <section className='flex flex-col gap-4 rounded-lg border p-8'>
      <h2 className='font-semibold text-2xl'>Escopo dos serviços</h2>
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
