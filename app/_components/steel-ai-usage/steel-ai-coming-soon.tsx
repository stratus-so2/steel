'use client'

import { SteelAiTopBar } from '@/app/_components/steel-ai/steel-ai-top-bar'
import { SteelIcon } from '@/components/icon/icon'
import { STEEL_AI_AREA_LINKS } from '../steel-ai/steel-ai-area-nav'

/**
 * Placeholder for a Steel AI area that is not built yet (Skills, Memória),
 * so the navigation never 404s. Replace the page that renders it.
 */
export function SteelAiComingSoon({
  segment,
  description,
}: {
  segment: 'skills' | 'memory'
  description: string
}) {
  const area = STEEL_AI_AREA_LINKS.find((link) => link.segment === segment)
  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <SteelAiTopBar title={area?.label} />
      <div className='flex flex-1 items-center justify-center px-4 py-10'>
        <div className='flex max-w-sm flex-col items-center gap-3 text-center'>
          {area ? (
            <SteelIcon
              icon={area.icon}
              strokeWidth={1.5}
              className='size-8 text-muted-foreground'
            />
          ) : null}
          <h1 className='font-semibold text-lg'>{area?.label} — em breve</h1>
          <p className='text-muted-foreground text-sm'>{description}</p>
        </div>
      </div>
    </div>
  )
}
