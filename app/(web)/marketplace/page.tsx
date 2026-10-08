import type { Metadata } from 'next'
import { NO_INDEX } from '@/src/lib/seo/metadata'

export const metadata: Metadata = {
  title: 'Marketplace | Steel',
  // Placeholder page: keep it out of the index until it has content.
  robots: NO_INDEX,
}

export default function MarketplacePage() {
  return <h1>MarketplacePage</h1>
}
