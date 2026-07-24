'use client'

import type { IframeConfig } from '@/src/schemas/crm-dashboard.schema'

export function IframeWidget({ config }: { config: IframeConfig }) {
  if (!config.url) {
    return (
      <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
        Nenhuma URL configurada.
      </div>
    )
  }
  return (
    <iframe
      src={config.url}
      title='Widget incorporado'
      className='h-full w-full rounded-md border-0'
      sandbox='allow-scripts allow-same-origin allow-popups allow-forms'
      referrerPolicy='no-referrer'
    />
  )
}
