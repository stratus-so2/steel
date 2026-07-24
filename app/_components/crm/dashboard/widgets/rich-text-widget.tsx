'use client'

import type { RichTextConfig } from '@/src/schemas/crm-dashboard.schema'

export function RichTextWidget({ config }: { config: RichTextConfig }) {
  if (!config.html?.trim()) {
    return (
      <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
        Sem conteúdo. Edite o widget para escrever.
      </div>
    )
  }
  return (
    <div
      className='tiptap h-full overflow-y-auto'
      dangerouslySetInnerHTML={{ __html: config.html }}
    />
  )
}
