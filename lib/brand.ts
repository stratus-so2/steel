import { baseEmailUrl } from './base-email-url'

/** Brand identity shared across transactional emails and public surfaces. */
export const brand = {
  legalName: 'Steel software, Inc.',
  displayName: 'Steel',
  url: baseEmailUrl,
  contactEmail: 'contato@steel.stratustelecom.com.br',
} as const

/**
 * Social channels rendered in the shared email footer. Icons are self-hosted
 * under `public/static/social/*.png` and served from `${baseEmailUrl}` — make
 * sure NEXT_PUBLIC_URL points at the public origin in production.
 */
 export const brandSocials = [
   {
     name: 'LinkedIn',
     url: 'https://www.linkedin.com/company/trysteel/',
     icon: `${baseEmailUrl}/static/social/linkedin.png`,
   },
   {
     name: 'GitHub',
     url: 'https://github.com/trysteel',
     icon: `${baseEmailUrl}/static/social/github.png`,
   },
   {
     name: 'X',
     url: 'https://x.com/trysteel',
     icon: `${baseEmailUrl}/static/social/x.png`,
   },
   {
     name: 'Instagram',
     url: 'https://instagram.com/trysteel_',
     icon: `${baseEmailUrl}/static/social/instagram.png`,
   },
 ] as const
