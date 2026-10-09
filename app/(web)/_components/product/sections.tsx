import {
  CheckmarkCircle02Icon,
  Key01Icon,
  LockKeyIcon,
  Shield01Icon,
  ShieldUserIcon,
  Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/button-link'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import {
  PRODUCT_CTA,
  PRODUCT_INFRA,
  PRODUCT_TRUST,
} from '@/src/config/web-product-pages/shared'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'
import { Reveal } from './reveal'
import { AppWindow } from './visuals/app-window'
import { ProductVisualView, ToneDot } from './visuals/product-visual'

/** Same horizontal rhythm as the web header and footer. */
export function WebContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className='font-mono text-xs tracking-[0.12em] text-brand uppercase sm:text-sm'>
      {children}
    </p>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'center' | 'start'
}) {
  return (
    <Reveal
      className={cn(
        'space-y-4',
        align === 'center' && 'mx-auto max-w-3xl text-center',
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className='text-3xl leading-tight font-normal tracking-tight text-balance text-foreground sm:text-4xl lg:text-5xl'>
        {title}
      </h2>
      {subtitle && (
        <p className='text-base text-pretty text-muted-foreground sm:text-lg'>
          {subtitle}
        </p>
      )}
    </Reveal>
  )
}

/** The textured frame (the footer banner's gradient) around a visual. */
export function VisualFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[url('/gradient.png')] bg-cover bg-center",
        className,
      )}
    >
      {children}
    </div>
  )
}

function CtaButtons({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-3',
        className,
      )}
    >
      <ButtonLink href={PRODUCT_CTA.primary.href} size='lg'>
        {PRODUCT_CTA.primary.label}
      </ButtonLink>
      <ButtonLink href={PRODUCT_CTA.secondary.href} size='lg' variant='outline'>
        {PRODUCT_CTA.secondary.label}
      </ButtonLink>
    </div>
  )
}

export function ProductHero({ page }: { page: ProductPage }) {
  const { hero } = page
  return (
    <section data-section='hero' className='pt-16 pb-10 sm:pt-24'>
      <WebContainer>
        <Reveal className='mx-auto max-w-4xl space-y-6 text-center'>
          <Eyebrow>{hero.eyebrow}</Eyebrow>
          <h1 className='text-4xl leading-[1.1] font-normal tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl'>
            {hero.title}
          </h1>
          <p className='mx-auto max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg'>
            {hero.subtitle}
          </p>
          <CtaButtons className='pt-2' />
        </Reveal>
        <Reveal delay={150} className='mt-14 sm:mt-16'>
          <VisualFrame className='px-3 pt-6 pb-6 sm:px-10 sm:pt-12 sm:pb-12 lg:px-14'>
            <AppWindow frame={hero.window} />
          </VisualFrame>
        </Reveal>
      </WebContainer>
    </section>
  )
}

function CardVisual({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-xl border border-border bg-background p-6',
        className,
      )}
    >
      <div className='w-full max-w-sm'>{children}</div>
    </div>
  )
}

export function ProductHighlights({ page }: { page: ProductPage }) {
  const { highlights } = page
  return (
    <section data-section='highlights' className='bg-muted/40 py-20 sm:py-28'>
      <WebContainer className='space-y-14'>
        <SectionHeading {...highlights} />
        <div className='grid gap-8 md:grid-cols-3'>
          {highlights.items.map((item, index) => (
            <Reveal key={item.title} delay={index * 100} className='space-y-4'>
              <CardVisual className='min-h-72 md:aspect-square md:min-h-0'>
                <ProductVisualView visual={item.visual} />
              </CardVisual>
              <div className='space-y-2'>
                <h3 className='text-lg font-medium text-foreground'>
                  {item.title}
                </h3>
                <p className='text-muted-foreground'>{item.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </WebContainer>
    </section>
  )
}

export function ProductRows({ page }: { page: ProductPage }) {
  if (!page.rows) return null
  return (
    <section data-section='rows' className='py-20 sm:py-28'>
      <WebContainer className='space-y-24 sm:space-y-32'>
        {page.rows.map((row, index) => (
          <div
            key={row.title}
            className='grid items-center gap-10 lg:grid-cols-2 lg:gap-20'
          >
            <Reveal
              className={cn('space-y-6', index % 2 === 1 && 'lg:order-2')}
            >
              <Eyebrow>{row.eyebrow}</Eyebrow>
              <h3 className='text-3xl leading-tight font-normal tracking-tight text-balance text-foreground sm:text-4xl'>
                {row.title}
              </h3>
              <p className='text-base text-muted-foreground sm:text-lg'>
                {row.description}
              </p>
              <ul className='space-y-4 pt-4'>
                {row.bullets.map((bullet) => (
                  <li
                    key={bullet.text}
                    className='flex items-start gap-3 text-foreground'
                  >
                    <SteelIcon
                      icon={bullet.icon}
                      size={20}
                      className='mt-0.5 shrink-0'
                    />
                    <span>{bullet.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120}>
              <VisualFrame className='flex min-h-80 items-center justify-center p-6 sm:p-12'>
                <div className='w-full max-w-md'>
                  <ProductVisualView visual={row.visual} />
                </div>
              </VisualFrame>
            </Reveal>
          </div>
        ))}
      </WebContainer>
    </section>
  )
}

export function ProductAiBento({ page }: { page: ProductPage }) {
  const { ai } = page
  return (
    <section
      data-section='ai'
      className='dark relative overflow-hidden bg-background py-20 text-foreground sm:py-28'
    >
      <div className='pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,var(--brand)_0%,transparent_65%)] opacity-15' />
      <WebContainer className='relative space-y-14'>
        <SectionHeading eyebrow={ai.eyebrow} title={ai.title} />
        <div className='grid gap-5 lg:grid-cols-6'>
          {ai.items.map((item, index) => (
            <Reveal
              key={item.title}
              delay={(index % 3) * 100}
              className={cn(
                'flex flex-col gap-8 rounded-xl border border-border bg-card/40 p-6 sm:p-8',
                index < 2 ? 'lg:col-span-3' : 'lg:col-span-2',
              )}
            >
              <div className='space-y-2'>
                <h3 className='text-lg font-medium'>{item.title}</h3>
                <p className='text-muted-foreground'>{item.description}</p>
              </div>
              <div className='mt-auto flex justify-center'>
                <div className='w-full max-w-md'>
                  <ProductVisualView visual={item.visual} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </WebContainer>
    </section>
  )
}

export function ProductDetails({ page }: { page: ProductPage }) {
  const { details } = page
  return (
    <section data-section='details' className='py-20 sm:py-28'>
      <WebContainer className='space-y-14'>
        <SectionHeading {...details} />
        <div className='grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3'>
          {details.items.map((item, index) => (
            <Reveal
              key={item.title}
              delay={(index % 3) * 80}
              className='space-y-4'
            >
              <div className='relative flex h-40 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30'>
                <div className='absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]' />
                <span className='relative flex size-14 items-center justify-center rounded-xl border border-border bg-background shadow-sm'>
                  <SteelIcon icon={item.icon} size={26} />
                </span>
              </div>
              <div className='space-y-2'>
                <h3 className='text-lg font-medium text-foreground'>
                  {item.title}
                </h3>
                <p className='text-muted-foreground'>{item.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </WebContainer>
    </section>
  )
}

export function ProductInfraBand(_: { page?: ProductPage }) {
  return (
    <section data-section='infra' className='py-16 sm:py-24'>
      <WebContainer>
        <Reveal className='dark grid gap-10 rounded-2xl border border-border bg-background p-8 text-foreground sm:p-12 lg:grid-cols-2'>
          <div className='flex flex-col gap-6'>
            <h2 className='text-2xl leading-tight font-normal tracking-tight sm:text-3xl'>
              {PRODUCT_INFRA.title}
            </h2>
            <p className='text-muted-foreground sm:text-lg'>
              {PRODUCT_INFRA.description}
            </p>
            <div className='mt-auto flex flex-wrap gap-3 pt-4'>
              <ButtonLink href={PRODUCT_INFRA.primary.href} size='lg'>
                {PRODUCT_INFRA.primary.label}
              </ButtonLink>
              <ButtonLink
                href={PRODUCT_INFRA.secondary.href}
                size='lg'
                variant='outline'
              >
                {PRODUCT_INFRA.secondary.label}
              </ButtonLink>
            </div>
          </div>
          <ul className='grid content-start gap-x-8 gap-y-5 sm:grid-cols-2'>
            {PRODUCT_INFRA.bullets.map((bullet) => (
              <li key={bullet} className='flex items-start gap-3'>
                <SteelIcon
                  icon={Tick02Icon}
                  size={18}
                  className='mt-0.5 shrink-0 text-muted-foreground'
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </WebContainer>
    </section>
  )
}

const UPTIME_BARS = Array.from({ length: 30 }, (_, i) => i)

function TrustVisual({ kind }: { kind: string }) {
  if (kind === 'status') {
    return (
      <div aria-hidden className='w-full space-y-4 text-xs'>
        {['Aplicação', 'Banco de dados', 'E-mail'].map((name) => (
          <div key={name} className='space-y-1.5'>
            <p className='flex items-center gap-1.5 text-foreground'>
              <ToneDot tone='success' />
              {name}
            </p>
            <div className='flex gap-[3px]'>
              {UPTIME_BARS.map((bar) => (
                <span
                  key={bar}
                  className='h-5 flex-1 rounded-[2px] bg-emerald-500/70'
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  const icons =
    kind === 'security'
      ? [LockKeyIcon, Shield01Icon, Key01Icon]
      : [ShieldUserIcon, CheckmarkCircle02Icon, LockKeyIcon]
  return (
    <div aria-hidden className='flex items-center justify-center gap-4'>
      {icons.map((icon, index) => (
        <span
          key={index}
          className={cn(
            'flex items-center justify-center rounded-full border border-border bg-background shadow-sm',
            index === 1 ? 'size-20' : 'size-14',
          )}
        >
          <SteelIcon icon={icon} size={index === 1 ? 32 : 22} />
        </span>
      ))}
    </div>
  )
}

export function ProductTrust(_: { page?: ProductPage }) {
  return (
    <section data-section='trust' className='pb-20 sm:pb-28'>
      <WebContainer className='space-y-12'>
        <Reveal className='grid gap-6 lg:grid-cols-2 lg:gap-20'>
          <h2 className='text-3xl leading-tight font-normal tracking-tight text-balance text-foreground sm:text-4xl lg:text-5xl'>
            {PRODUCT_TRUST.title}
          </h2>
          <p className='text-base text-muted-foreground sm:text-lg'>
            {PRODUCT_TRUST.description}
          </p>
        </Reveal>
        <div className='grid gap-6 md:grid-cols-3'>
          {PRODUCT_TRUST.cards.map((card, index) => (
            <Reveal
              key={card.kind}
              delay={index * 100}
              className='flex flex-col overflow-hidden rounded-xl border border-border bg-card'
            >
              <div className='flex h-48 items-center justify-center border-b border-border bg-muted/30 px-8'>
                <TrustVisual kind={card.kind} />
              </div>
              <div className='flex flex-1 flex-col gap-3 p-6'>
                <h3 className='text-lg font-medium text-foreground'>
                  {card.title}
                </h3>
                <p className='text-muted-foreground'>{card.description}</p>
                <Link
                  href={card.link.href}
                  className='mt-auto pt-2 font-medium text-foreground underline-offset-4 hover:underline'
                >
                  {card.link.label} →
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </WebContainer>
    </section>
  )
}

export function ProductClosingCta({ page }: { page: ProductPage }) {
  return (
    <section
      data-section='cta'
      className='border-t border-border bg-muted/40 py-20 sm:py-28'
    >
      <WebContainer>
        <Reveal className='mx-auto max-w-3xl space-y-6 text-center'>
          <h2 className='text-3xl leading-tight font-normal tracking-tight text-balance text-foreground sm:text-5xl'>
            {page.cta.title}
          </h2>
          <p className='text-base text-muted-foreground sm:text-lg'>
            {page.cta.subtitle}
          </p>
          <CtaButtons className='pt-2' />
          <p className='text-sm text-muted-foreground'>
            Já tem conta?{' '}
            <Link
              href={PRODUCT_CTA.signIn.href}
              className='font-medium text-foreground underline-offset-4 hover:underline'
            >
              {PRODUCT_CTA.signIn.label}
            </Link>
          </p>
        </Reveal>
      </WebContainer>
    </section>
  )
}
