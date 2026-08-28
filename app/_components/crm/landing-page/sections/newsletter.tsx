'use client'

import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from './types'

type NewsletterContent = Extract<
  CrmLandingPageSectionContent,
  { type: 'NEWSLETTER' }
>

export function newsletterDefaultContent(): NewsletterContent {
  return { type: 'NEWSLETTER', title: 'Receba nossas novidades' }
}

export function NewsletterSection({
  content,
  onChange,
  readOnly,
}: LandingPageSectionProps<NewsletterContent>) {
  return (
    <section className='flex flex-col items-center gap-6 px-6 py-16 text-center sm:px-12'>
      <GhostInput
        as='h2'
        value={content.title}
        onCommit={(v) => onChange?.({ ...content, title: v })}
        placeholder='Título da seção'
        readOnly={readOnly}
        className='font-semibold text-2xl tracking-tight sm:text-3xl'
      />
      {content.description || !readOnly ? (
        <GhostTextarea
          value={content.description ?? ''}
          onCommit={(v) =>
            onChange?.({ ...content, description: v || undefined })
          }
          placeholder='Descrição de apoio'
          readOnly={readOnly}
          as='p'
          className='max-w-md text-balance text-muted-foreground text-sm'
        />
      ) : null}

      <div className='flex w-full max-w-md items-center gap-2 rounded-lg border bg-card p-2'>
        <GhostInput
          value={content.placeholder ?? ''}
          onCommit={(v) =>
            onChange?.({ ...content, placeholder: v || undefined })
          }
          placeholder='Seu e-mail'
          readOnly={readOnly}
          className='flex-1 px-2 text-muted-foreground text-sm'
        />
        <span className='shrink-0 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm'>
          <GhostInput
            value={content.ctaLabel ?? ''}
            onCommit={(v) =>
              onChange?.({ ...content, ctaLabel: v || undefined })
            }
            placeholder='Inscrever'
            readOnly={readOnly}
            className='text-inherit'
          />
        </span>
      </div>
    </section>
  )
}
