'use client'

import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import { notify } from '@/lib/notify'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type TestimonialContent = Extract<
  CrmLandingPageSectionContent,
  { type: 'TESTIMONIAL' }
>

const BASE = '/landing-page-templates/b2b'

// O frame "Testimonial" do Figma mostra 3 depoimentos lado a lado, mas o
// schema TESTIMONIAL modela só um (quote/authorName/authorRole/avatarUrl) —
// não uma lista. Seguindo o mesmo tipo de solução do bloco "Video" (visual
// fiel, sem estender o schema por causa de um único template), só o
// primeiro card é editável via `content`; os outros dois ficam com o texto
// real do Figma, fixos.
const STATIC_CARDS = [
  {
    quote:
      'Simply the best. Better than all the rest. I’d recommend this product to beginners and advanced users.',
    authorName: 'Curtis Rhodes',
    authorRole: 'Digital Marketer',
    avatarUrl: `${BASE}/testimonial-avatar-2.png`,
  },
  {
    quote:
      'Must have book for all, who want to be Product Designer or Interaction Designer.',
    authorName: 'Lucas Mann',
    authorRole: 'Co Founder',
    avatarUrl: `${BASE}/testimonial-avatar-3.png`,
  },
]

export function testimonialDefaultContent(): TestimonialContent {
  return {
    type: 'TESTIMONIAL',
    quote:
      'You made it so simple. My new site is so much faster and easier to work with than my old site.',
    authorName: 'Isabella Chavez',
    authorRole: 'Graphic Designer',
    avatarUrl: `${BASE}/testimonial-avatar-1.png`,
    style: 'default',
  }
}

function StaticCard({
  quote,
  authorName,
  authorRole,
  avatarUrl,
}: (typeof STATIC_CARDS)[number]) {
  return (
    <div className='flex flex-col gap-6 rounded-[10px] border border-[#e7e9ed] bg-white p-8'>
      <img
        src={avatarUrl}
        alt={authorName}
        className='size-[54px] rounded-full object-cover'
      />
      <p className='text-[#161c2d] text-[21px] leading-[1.55] tracking-[-0.5px]'>
        “{quote}”
      </p>
      <div className='flex items-center gap-1 text-[17px]'>
        <span className='font-bold text-[#161c2d]'>{authorName}</span>
        <span className='text-[#161c2d]/70'>·</span>
        <span className='text-[#161c2d]/70'>{authorRole}</span>
      </div>
    </div>
  )
}

export function B2bTestimonial({
  content,
  onChange,
  workspaceId,
  readOnly,
}: LandingPageSectionProps<TestimonialContent>) {
  async function handleImage(file: File) {
    const res = await uploadCrmLandingPageImage(workspaceId ?? '', file)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível enviar a imagem.')
      return
    }
    onChange?.({ ...content, avatarUrl: res.data.url })
  }

  return (
    <section className='bg-white px-6 py-20 sm:px-10 sm:py-28 lg:px-[123px]'>
      {/* Título e subtítulo fixos — o schema TESTIMONIAL modela um único
          depoimento (sem título de seção), então este cabeçalho segue o
          texto real do Figma, não-editável, igual às outras seções
          decorativas deste template. */}
      <div className='mx-auto mb-16 flex max-w-2xl flex-col items-center gap-4 text-center'>
        <h2 className='text-balance font-bold text-[#161c2d] text-[28px] leading-tight tracking-[-1px] sm:text-[36px] sm:leading-[48px]'>
          What people say about us
        </h2>
        <p className='text-[#161c2d]/70 text-[19px] leading-[1.7]'>
          With lots of unique blocks, you can easily build a page without
          coding. Build your next landing page.
        </p>
      </div>

      <div className='mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
        <div className='flex flex-col gap-6 rounded-[10px] border border-[#e7e9ed] bg-white p-8'>
          <GhostImage
            value={content.avatarUrl}
            onUpload={handleImage}
            readOnly={readOnly}
            alt={content.authorName}
            className='size-[54px] shrink-0 rounded-full object-cover'
          />

          <GhostTextarea
            value={content.quote}
            onCommit={(v) => onChange?.({ ...content, quote: v })}
            placeholder='Depoimento'
            readOnly={readOnly}
            as='p'
            className='text-[#161c2d] text-[21px] leading-[1.55] tracking-[-0.5px]'
          />

          <div className='flex items-center gap-1 text-[17px]'>
            <GhostInput
              value={content.authorName}
              onCommit={(v) => onChange?.({ ...content, authorName: v })}
              placeholder='Nome'
              readOnly={readOnly}
              className='font-bold text-[#161c2d]'
            />
            {content.authorRole || !readOnly ? (
              <>
                <span className='text-[#161c2d]/70'>·</span>
                <GhostInput
                  value={content.authorRole ?? ''}
                  onCommit={(v) =>
                    onChange?.({ ...content, authorRole: v || undefined })
                  }
                  placeholder='Cargo/empresa'
                  readOnly={readOnly}
                  className='text-[#161c2d]/70'
                />
              </>
            ) : null}
          </div>
        </div>

        {STATIC_CARDS.map((card) => (
          <StaticCard key={card.authorName} {...card} />
        ))}
      </div>
    </section>
  )
}
