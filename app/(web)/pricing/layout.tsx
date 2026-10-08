import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { publicPageMetadata } from '@/src/lib/seo/metadata'

export const metadata: Metadata = publicPageMetadata({
  title: 'Planos e preços | Steel',
  description:
    'Planos do Steel por assento: ServiceDesk, CRM e WhatsApp Business num só workspace.',
  path: '/pricing',
})

export default function WebLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
