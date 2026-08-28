'use client'

import { Message01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type AboutContent = Extract<CrmLandingPageSectionContent, { type: 'ABOUT' }>

const PATTERN_BG =
  '/landing-page-templates/consultation/cta-form-bg-pattern.png'

export function consultationAboutDefaultContent(): AboutContent {
  return {
    type: 'ABOUT',
    title: 'Get a free consultancy from our expert right now!',
    description:
      'With lots of unique blocks, you can easily build a page without coding. Build your next landing page so quickly with Albino.',
    imageUrls: [],
  }
}

/**
 * Mapeia o bloco "CTA Form" do Figma (painel escuro + card de formulário
 * com Nome/Email/Telefone/Serviço) pro tipo ABOUT — mais próximo em forma
 * (título + descrição), mas sem campos de CTA/formulário no schema. O card
 * de formulário e o botão "Get Free Consultancy" ficam decorativos/fixos
 * no componente (sem submissão real — nenhum outro template tem backend de
 * formulário funcional). Ver relatório final pro gap.
 */
export function ConsultationAbout({
  content,
  onChange,
  readOnly,
}: LandingPageSectionProps<AboutContent>) {
  return (
    <section className='relative overflow-hidden bg-[#161c2d] px-6 py-20 sm:px-10 sm:py-28 lg:px-[123px]'>
      <img
        src={PATTERN_BG}
        alt=''
        aria-hidden
        className='pointer-events-none absolute inset-0 size-full object-cover opacity-[0.14] mix-blend-multiply'
      />

      <div className='relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2'>
        <div className='flex max-w-md flex-col gap-6'>
          <div className='flex size-[87px] items-center justify-center rounded-full bg-[#161c2d]/60'>
            <SteelIcon
              icon={Message01Icon}
              strokeWidth={2}
              size={32}
              className='text-[#68d585]'
            />
          </div>

          <GhostInput
            as='h2'
            value={content.title}
            onCommit={(v) => onChange?.({ ...content, title: v })}
            placeholder='Título da seção'
            readOnly={readOnly}
            className='text-balance font-bold text-[28px] text-white leading-tight tracking-[-1.2px] sm:text-[36px] sm:leading-[48px]'
          />

          <GhostTextarea
            value={content.description}
            onCommit={(v) => onChange?.({ ...content, description: v })}
            placeholder='Descrição'
            readOnly={readOnly}
            as='p'
            className='text-[19px] text-white/65 leading-[1.7]'
          />
        </div>

        <div
          aria-hidden
          className='flex flex-col gap-4 rounded-[10px] border border-[#e7e9ed] bg-white p-8 shadow-[0px_34px_33px_-23px_rgba(22,28,45,0.13)]'
        >
          <label className='flex flex-col gap-2'>
            <span className='font-bold text-[#161c2d] text-[15px] tracking-[-0.1px]'>
              Name
            </span>
            <input
              disabled
              placeholder='i.e. John Doe'
              className='rounded-lg border border-[#e7e9ed] px-[18px] py-3 text-[#161c2d]/70 text-[15px] tracking-[-0.1px]'
            />
          </label>
          <label className='flex flex-col gap-2'>
            <span className='font-bold text-[#161c2d] text-[15px] tracking-[-0.1px]'>
              Email
            </span>
            <input
              disabled
              placeholder='i.e. john@mail.com'
              className='rounded-lg border border-[#e7e9ed] px-[18px] py-3 text-[#161c2d]/70 text-[15px] tracking-[-0.1px]'
            />
          </label>
          <label className='flex flex-col gap-2'>
            <span className='font-bold text-[#161c2d] text-[15px] tracking-[-0.1px]'>
              Phone
            </span>
            <input
              disabled
              placeholder='i.e. 123-456-7890'
              className='rounded-lg border border-[#e7e9ed] px-[18px] py-3 text-[#161c2d]/70 text-[15px] tracking-[-0.1px]'
            />
          </label>
          <label className='flex flex-col gap-2'>
            <span className='font-bold text-[#161c2d] text-[15px] tracking-[-0.1px]'>
              Which service do you need?
            </span>
            <select
              disabled
              className='rounded-lg border border-[#e7e9ed] px-[18px] py-3 text-[#161c2d] text-[15px] tracking-[-0.1px]'
            >
              <option>Select a service</option>
            </select>
          </label>
          <button
            type='button'
            disabled
            className='mt-2 rounded-lg bg-[#473bf0] py-4 font-bold text-[17px] text-white tracking-[-0.6px]'
          >
            Get Free Consultancy
          </button>
        </div>
      </div>
    </section>
  )
}
