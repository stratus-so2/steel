'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { GhostInput } from '@/components/ui/ghost-input'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from '../types'

type FooterContent = Extract<CrmLandingPageSectionContent, { type: 'FOOTER' }>

const BASE = '/landing-page-templates/mobile-app'
const APP_STORE = `${BASE}/app-store-badge.png`
const PLAY_STORE = `${BASE}/play-store-badge.png`

const SOCIAL_ICONS: Record<string, string> = {
  twitter: `${BASE}/social-twitter.svg`,
  facebook: `${BASE}/social-facebook.svg`,
  instagram: `${BASE}/social-instagram.svg`,
  linkedin: `${BASE}/social-linkedin.svg`,
}

export function footerDefaultContent(): FooterContent {
  return {
    type: 'FOOTER',
    logoText: 'Brainwave.io',
    linkGroups: [
      {
        title: 'Company',
        links: [
          { label: 'About us', href: '#' },
          { label: 'Contact us', href: '#' },
          { label: 'Careers', href: '#' },
          { label: 'Press', href: '#' },
        ],
      },
      {
        title: 'Product',
        links: [
          { label: 'Features', href: '#' },
          { label: 'Pricing', href: '#' },
          { label: 'News', href: '#' },
          { label: 'Help desk', href: '#' },
          { label: 'Support', href: '#' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Privacy Policy', href: '#' },
          { label: 'Terms & Conditions', href: '#' },
          { label: 'Return Policy', href: '#' },
        ],
      },
    ],
    socialLinks: [
      { platform: 'twitter', href: '#' },
      { platform: 'facebook', href: '#' },
      { platform: 'instagram', href: '#' },
      { platform: 'linkedin', href: '#' },
    ],
  }
}

export function MobileAppFooter({
  content,
  onChange,
  readOnly,
}: LandingPageSectionProps<FooterContent>) {
  function updateGroupTitle(groupIndex: number, title: string) {
    onChange?.({
      ...content,
      linkGroups: content.linkGroups.map((g, i) =>
        i === groupIndex ? { ...g, title } : g,
      ),
    })
  }

  function updateLink(
    groupIndex: number,
    linkIndex: number,
    patch: Partial<{ label: string; href: string }>,
  ) {
    onChange?.({
      ...content,
      linkGroups: content.linkGroups.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              links: g.links.map((l, j) =>
                j === linkIndex ? { ...l, ...patch } : l,
              ),
            }
          : g,
      ),
    })
  }

  function addLink(groupIndex: number) {
    onChange?.({
      ...content,
      linkGroups: content.linkGroups.map((g, i) =>
        i === groupIndex
          ? { ...g, links: [...g.links, { label: 'Link', href: '#' }] }
          : g,
      ),
    })
  }

  function removeLink(groupIndex: number, linkIndex: number) {
    onChange?.({
      ...content,
      linkGroups: content.linkGroups.map((g, i) =>
        i === groupIndex
          ? { ...g, links: g.links.filter((_, j) => j !== linkIndex) }
          : g,
      ),
    })
  }

  const year = new Date().getFullYear()

  return (
    <footer id='footer' className='bg-white px-6 pt-16 sm:px-10 lg:px-[123px]'>
      {/* Colunas */}
      <div className='mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-12 pb-16 sm:grid-cols-4'>
        {content.linkGroups.map((group, groupIndex) => (
          <div key={groupIndex} className='flex flex-col gap-4'>
            <GhostInput
              value={group.title}
              onCommit={(v) => updateGroupTitle(groupIndex, v)}
              placeholder='Título da coluna'
              readOnly={readOnly}
              className='text-[#161c2d]/70 text-[15px]'
            />
            <ul className='flex flex-col gap-2'>
              {group.links.map((link, linkIndex) => (
                <li
                  key={linkIndex}
                  className='group/link flex items-center gap-1'
                >
                  <a href={readOnly ? link.href : undefined}>
                    <GhostInput
                      value={link.label}
                      onCommit={(v) =>
                        updateLink(groupIndex, linkIndex, { label: v })
                      }
                      readOnly={readOnly}
                      className='text-[#161c2d] text-[17px]'
                    />
                  </a>
                  {!readOnly ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-xs'
                      className='opacity-0 group-hover/link:opacity-100'
                      aria-label='Remover link'
                      onClick={() => removeLink(groupIndex, linkIndex)}
                    >
                      <SteelIcon
                        icon={Delete02Icon}
                        strokeWidth={2}
                        size={12}
                      />
                    </Button>
                  ) : null}
                </li>
              ))}
              {!readOnly ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-xs'
                  aria-label='Adicionar link'
                  onClick={() => addLink(groupIndex)}
                >
                  <SteelIcon icon={Add01Icon} strokeWidth={2} size={12} />
                </Button>
              ) : null}
            </ul>
          </div>
        ))}

        <div className='flex flex-col gap-4'>
          <span className='text-[#161c2d]/70 text-[15px]'>
            Download Our App
          </span>
          <div className='flex flex-col items-start gap-3'>
            <img src={APP_STORE} alt='App Store' className='h-[42px] w-auto' />
            <img
              src={PLAY_STORE}
              alt='Google Play'
              className='h-[42px] w-auto'
            />
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-6xl border-[#161c2d]/10 border-t' />

      {/* Barra inferior */}
      <div className='mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 py-6 sm:flex-row'>
        <p className='text-[#161c2d] text-[15px]'>
          © {year}{' '}
          <GhostInput
            value={content.logoText ?? ''}
            onCommit={(v) =>
              onChange?.({ ...content, logoText: v || undefined })
            }
            placeholder='Nome da marca'
            readOnly={readOnly}
            className='inline-flex text-[#161c2d] text-[15px]'
          />
          . Todos os direitos reservados.
        </p>

        <div className='flex items-center gap-4'>
          {content.socialLinks.map((social, index) => {
            const icon = SOCIAL_ICONS[social.platform.toLowerCase()]
            if (!icon) return null
            return (
              <a
                key={`${social.platform}-${index}`}
                href={social.href}
                className='opacity-80 hover:opacity-100'
                aria-label={social.platform}
              >
                <img src={icon} alt='' className='h-4 w-4' />
              </a>
            )
          })}
        </div>
      </div>
    </footer>
  )
}
