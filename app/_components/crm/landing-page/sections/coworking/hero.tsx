'use client'

import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import { coworkingLogoFont } from '@/src/lib/landing-page-templates/coworking/fonts'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type HeroContent = Extract<CrmLandingPageSectionContent, { type: 'HERO' }>

const BASE = '/landing-page-templates/coworking'
const DEFAULT_BG = `${BASE}/hero-bg.jpg`
const PIN_ICON = `${BASE}/pin-icon.svg`
const CALENDAR_ICON = `${BASE}/calendar-icon.svg`
const DROPDOWN_ICON = `${BASE}/dropdown-icon.svg`
const VIDEO_ICON = `${BASE}/video-play-icon.svg`
const CHEVRON_DOWN_ICON = `${BASE}/chevron-down-icon.svg`

export function heroDefaultContent(): HeroContent {
  return {
    type: 'HERO',
    eyebrow: 'Shared space in your town',
    title: 'Rent desk space in a shared office environment',
    ctaLabel: 'Search Place',
    ctaHref: '#locations',
    imageUrl: DEFAULT_BG,
  }
}

export function CoworkingHero({
  content,
  onChange,
  workspaceId,
  readOnly,
}: LandingPageSectionProps<HeroContent>) {
  async function handleImage(file: File) {
    const res = await uploadCrmLandingPageImage(workspaceId ?? '', file)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível enviar a imagem.')
      return
    }
    onChange?.({ ...content, imageUrl: res.data.url })
  }

  return (
    <section className='relative overflow-hidden bg-[#161c2d]'>
      <div className='absolute inset-0'>
        <GhostImage
          value={content.imageUrl}
          onUpload={handleImage}
          readOnly={readOnly}
          alt=''
          className='size-full object-cover'
        />
        <div className='absolute inset-0 bg-[#161c2d]/60' aria-hidden />
      </div>

      <div className='relative mx-auto flex max-w-[1600px] flex-col items-center px-6 py-10 sm:px-10 lg:px-[123px] lg:py-16'>
        <div className='flex w-full items-center justify-between'>
          <span
            className={cn(
              coworkingLogoFont.className,
              'font-bold text-[24px] text-white',
            )}
          >
            Brainwave.io
          </span>
          <nav className='hidden items-center gap-8 font-bold text-[15px] text-white tracking-[-0.1px] sm:flex'>
            <span>Demos</span>
            <span>Pages</span>
            <span>Support</span>
            <span>Contact</span>
          </nav>
        </div>

        <div className='flex flex-col items-center gap-6 py-24 text-center sm:py-32 lg:py-40'>
          {content.eyebrow || !readOnly ? (
            <GhostInput
              value={content.eyebrow ?? ''}
              onCommit={(v) =>
                onChange?.({ ...content, eyebrow: v || undefined })
              }
              placeholder='Texto de destaque'
              readOnly={readOnly}
              className='text-center font-bold text-[#68d585] text-[13px] uppercase tracking-[1.6px]'
            />
          ) : null}

          <GhostInput
            as='h1'
            value={content.title}
            onCommit={(v) => onChange?.({ ...content, title: v })}
            placeholder='Título principal'
            readOnly={readOnly}
            className='max-w-3xl text-balance text-center font-bold text-[38px] text-white leading-[1.1] tracking-[-1px] sm:text-[48px] lg:text-[60px] lg:leading-[65px] lg:tracking-[-2px]'
          />

          <div className='mt-4 flex w-full max-w-3xl flex-col items-stretch gap-3 rounded-[10px] bg-white p-3 shadow-[0px_54px_53px_-23px_rgba(22,28,45,0.5)] sm:flex-row sm:items-center'>
            <div className='flex flex-1 items-center gap-3 px-3 py-2'>
              <img
                src={PIN_ICON}
                alt=''
                aria-hidden
                className='h-[17px] w-[13px] shrink-0'
              />
              <span className='text-[#161c2d] text-[15px] tracking-[-0.1px]'>
                Select Location
              </span>
              <img
                src={DROPDOWN_ICON}
                alt=''
                aria-hidden
                className='ml-auto h-[5px] w-[10px] shrink-0 opacity-60'
              />
            </div>
            <div className='hidden w-px self-stretch bg-[#e7e9ed] sm:block' />
            <div className='flex flex-1 items-center gap-3 px-3 py-2'>
              <img
                src={CALENDAR_ICON}
                alt=''
                aria-hidden
                className='h-[18px] w-[18px] shrink-0'
              />
              <span className='text-[#161c2d] text-[15px] tracking-[-0.1px]'>
                Select Date
              </span>
              <img
                src={DROPDOWN_ICON}
                alt=''
                aria-hidden
                className='ml-auto h-[5px] w-[10px] shrink-0 opacity-60'
              />
            </div>

            {content.ctaLabel || !readOnly ? (
              <a
                href={readOnly ? content.ctaHref : undefined}
                data-cta
                className='inline-flex shrink-0 items-center justify-center rounded-[8px] bg-[#473bf0] px-8 py-4 font-bold text-[17px] text-white tracking-[-0.6px] transition-opacity hover:opacity-90'
              >
                <GhostInput
                  value={content.ctaLabel ?? ''}
                  onCommit={(v) =>
                    onChange?.({ ...content, ctaLabel: v || undefined })
                  }
                  placeholder='Texto do botão'
                  readOnly={readOnly}
                  className='text-inherit'
                />
              </a>
            ) : null}
          </div>

          <a
            href='#facts'
            className='mt-6 inline-flex items-center gap-2 font-bold text-[17px] text-white tracking-[-0.2px] hover:opacity-80'
          >
            <img
              src={VIDEO_ICON}
              alt=''
              aria-hidden
              className='h-[19px] w-[19px]'
            />
            Take virtual tour of our spaces
          </a>
        </div>

        <a
          href='#facts'
          aria-label='Rolar para baixo'
          className='mb-4 flex size-10 items-center justify-center rounded-full border border-white/40 hover:bg-white/10'
        >
          <img src={CHEVRON_DOWN_ICON} alt='' className='h-[6px] w-[12px]' />
        </a>
      </div>
    </section>
  )
}
