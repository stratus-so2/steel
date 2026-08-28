'use client'

import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import { notify } from '@/lib/notify'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type AboutContent = Extract<CrmLandingPageSectionContent, { type: 'ABOUT' }>

const BASE = '/landing-page-templates/b2b'

// O frame "Content 01" do Figma tem uma mini-lista de 3 números (1M+, 92%,
// 4.9/5.0) ao lado do texto — o schema ABOUT não tem um campo dedicado pra
// isso (só eyebrow/title/description/imagens), então a lista fica estática
// aqui, seguindo a orientação da task de não estender o vocabulário de
// seções por causa de um único template.
const FACTS = [
  {
    value: '1M+',
    label: 'Customers visit Albino every month to get their service done.',
  },
  {
    value: '92%',
    label: 'Satisfaction rate comes from our awesome customers.',
  },
  {
    value: '4.9/5.0',
    label: 'Average customer ratings we have got all over internet.',
  },
]

export function aboutDefaultContent(): AboutContent {
  return {
    type: 'ABOUT',
    title: 'Experienced experts are giving advices.',
    description:
      'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
    imageUrl: `${BASE}/content01-photo.png`,
    imageUrls: [],
  }
}

export function B2bAbout({
  content,
  onChange,
  workspaceId,
  readOnly,
}: LandingPageSectionProps<AboutContent>) {
  async function handleImage(file: File) {
    const res = await uploadCrmLandingPageImage(workspaceId ?? '', file)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível enviar a imagem.')
      return
    }
    onChange?.({ ...content, imageUrl: res.data.url })
  }

  return (
    <section className='bg-white px-6 py-16 sm:px-10 sm:py-24 lg:px-[123px]'>
      <div className='mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_auto_1fr] lg:gap-16'>
        <div className='flex flex-col gap-6'>
          <GhostInput
            as='h2'
            value={content.title}
            onCommit={(v) => onChange?.({ ...content, title: v })}
            placeholder='Título da seção'
            readOnly={readOnly}
            className='text-balance font-bold text-[#161c2d] text-[28px] leading-tight tracking-[-1px] sm:text-[32px] sm:leading-[44px]'
          />
          <GhostTextarea
            value={content.description}
            onCommit={(v) => onChange?.({ ...content, description: v })}
            placeholder='Descrição'
            readOnly={readOnly}
            as='p'
            className='max-w-sm text-[#161c2d]/70 text-[17px] leading-[1.7] sm:text-[19px]'
          />
          <a
            href='#footer'
            data-cta
            className='inline-flex w-fit items-center justify-center rounded-lg bg-[#473bf0] px-6 py-4 font-bold text-[17px] text-white tracking-[-0.6px] transition-opacity hover:opacity-90'
          >
            Learn how we work
          </a>
        </div>

        <GhostImage
          value={content.imageUrl}
          onUpload={handleImage}
          readOnly={readOnly}
          alt={content.title}
          className='aspect-[308/419] w-full max-w-[308px] rounded-[8px] object-cover lg:mx-0'
        />

        <div className='flex flex-col gap-8'>
          {FACTS.map((fact) => (
            <div key={fact.value} className='flex flex-col gap-2'>
              <span className='font-bold text-[#161c2d] text-[32px] tracking-[-1.2px]'>
                {fact.value}
              </span>
              <span className='max-w-xs text-[#161c2d]/70 text-[19px] leading-[1.7]'>
                {fact.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
