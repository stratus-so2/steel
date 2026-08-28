'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { GhostInput } from '@/components/ui/ghost-input'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from './types'

type FooterContent = Extract<CrmLandingPageSectionContent, { type: 'FOOTER' }>

export function footerDefaultContent(): FooterContent {
  return { type: 'FOOTER', links: [] }
}

export function FooterSection({
  content,
  onChange,
  readOnly,
}: LandingPageSectionProps<FooterContent>) {
  function addLink() {
    onChange?.({
      ...content,
      links: [...content.links, { label: 'Link', href: '#' }],
    })
  }

  function updateLink(
    index: number,
    patch: Partial<{ label: string; href: string }>,
  ) {
    onChange?.({
      ...content,
      links: content.links.map((l, i) =>
        i === index ? { ...l, ...patch } : l,
      ),
    })
  }

  function removeLink(index: number) {
    onChange?.({
      ...content,
      links: content.links.filter((_, i) => i !== index),
    })
  }

  return (
    <footer
      id='footer'
      className='flex flex-col items-center gap-6 border-t px-6 py-12 text-center sm:px-12'
    >
      {content.text || !readOnly ? (
        <GhostInput
          value={content.text ?? ''}
          onCommit={(v) => onChange?.({ ...content, text: v || undefined })}
          placeholder='Chamada final'
          readOnly={readOnly}
          className='max-w-md text-balance font-medium text-lg'
        />
      ) : null}

      <nav className='flex flex-wrap items-center justify-center gap-1 sm:gap-4'>
        {content.links.map((link, index) => (
          <div
            key={`${link.label}-${index}`}
            className='group/nav-link flex items-center gap-1'
          >
            <GhostInput
              value={link.label}
              onCommit={(v) => updateLink(index, { label: v })}
              readOnly={readOnly}
              className='text-muted-foreground text-sm hover:text-foreground'
            />
            {!readOnly ? (
              <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                className='opacity-0 group-hover/nav-link:opacity-100'
                aria-label='Remover link'
                onClick={() => removeLink(index)}
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} size={14} />
              </Button>
            ) : null}
          </div>
        ))}
        {!readOnly ? (
          <Button
            type='button'
            variant='ghost'
            size='icon-xs'
            aria-label='Adicionar link'
            onClick={addLink}
          >
            <SteelIcon icon={Add01Icon} strokeWidth={2} size={14} />
          </Button>
        ) : null}
      </nav>

      <p className='text-muted-foreground text-xs'>
        © {new Date().getFullYear()} — Todos os direitos reservados.
      </p>
    </footer>
  )
}
