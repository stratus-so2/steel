'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type FaqContent = Extract<CrmLandingPageSectionContent, { type: 'FAQ' }>

const BASE = '/landing-page-templates/coworking'
const CHEVRON_UP = `${BASE}/faq-chevron-up.svg`
const CHEVRON_RIGHT = `${BASE}/faq-chevron-right.svg`

/**
 * Mapeia a metade direita de "Content 02" (accordion de FAQ) pro tipo FAQ —
 * ver comentário em `steps.tsx` sobre a divisão do frame original em duas
 * seções. Fundo escuro mantido pra continuar a leitura visual do bloco.
 */
export function faqDefaultContent(): FaqContent {
  return {
    type: 'FAQ',
    title: 'Frequently asked questions',
    items: [
      {
        question: 'How to setup Shade Pro?',
        answer:
          'With lots of unique blocks, you can easily build a page with coding. Build your next landing page. Integer ut obe ryn. Sed feugiat vitae turpis a porta.',
      },
      {
        question: 'Can I use Shade Pro for my clients?',
        answer: '',
      },
      {
        question: 'How often do you release update?',
        answer: '',
      },
      {
        question: 'How can I access to old version?',
        answer: '',
      },
    ],
  }
}

export function CoworkingFaq({
  content,
  onChange,
  readOnly,
}: LandingPageSectionProps<FaqContent>) {
  const [openIndex, setOpenIndex] = useState(0)

  function updateItem(
    index: number,
    patch: Partial<{ question: string; answer: string }>,
  ) {
    onChange?.({
      ...content,
      items: content.items.map((it, i) =>
        i === index ? { ...it, ...patch } : it,
      ),
    })
  }

  function addItem() {
    onChange?.({
      ...content,
      items: [...content.items, { question: 'Nova pergunta', answer: '' }],
    })
  }

  function removeItem(index: number) {
    onChange?.({
      ...content,
      items: content.items.filter((_, i) => i !== index),
    })
  }

  return (
    <section className='bg-[#161c2d] px-6 pt-10 pb-20 sm:px-10 lg:px-[123px]'>
      {content.title || !readOnly ? (
        <GhostInput
          as='h2'
          value={content.title}
          onCommit={(v) => onChange?.({ ...content, title: v })}
          placeholder='Título da seção'
          readOnly={readOnly}
          className='sr-only'
        />
      ) : null}

      <div className='mx-auto flex max-w-xl flex-col overflow-hidden rounded-[10px] bg-white'>
        {content.items.map((item, index) => {
          const isOpen = openIndex === index
          return (
            <div
              key={index}
              className='group/item border-[#161c2d]/10 border-b px-6 py-6 last:border-b-0'
            >
              <button
                type='button'
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className='flex w-full items-center justify-between gap-4 text-left'
              >
                <GhostInput
                  as='h3'
                  value={item.question}
                  onCommit={(v) => updateItem(index, { question: v })}
                  placeholder='Pergunta'
                  readOnly={readOnly}
                  className='font-bold text-[#161c2d] text-[21px] tracking-[-0.5px]'
                />
                <img
                  src={isOpen ? CHEVRON_UP : CHEVRON_RIGHT}
                  alt=''
                  aria-hidden
                  className='h-[8px] w-[14px] shrink-0'
                />
                {!readOnly ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    className='shrink-0 opacity-0 group-hover/item:opacity-100'
                    aria-label='Remover pergunta'
                    onClick={(e) => {
                      e.stopPropagation()
                      removeItem(index)
                    }}
                  >
                    <SteelIcon icon={Delete02Icon} strokeWidth={2} size={14} />
                  </Button>
                ) : null}
              </button>
              {isOpen && (item.answer || !readOnly) ? (
                <GhostTextarea
                  value={item.answer}
                  onCommit={(v) => updateItem(index, { answer: v })}
                  placeholder='Resposta'
                  readOnly={readOnly}
                  as='p'
                  className='mt-3 text-[#161c2d]/70 text-[17px] leading-[1.7]'
                />
              ) : null}
            </div>
          )
        })}
        {!readOnly ? (
          <button
            type='button'
            onClick={addItem}
            className='flex min-h-16 items-center justify-center gap-1 border-[#161c2d]/10 border-t text-[#161c2d]/60 text-sm hover:bg-muted/40'
          >
            <SteelIcon icon={Add01Icon} strokeWidth={2} />
            Adicionar pergunta
          </button>
        ) : null}
      </div>
    </section>
  )
}
