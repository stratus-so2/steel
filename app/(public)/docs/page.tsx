import type { Metadata } from 'next'
import { NO_INDEX } from '@/src/lib/seo/metadata'

export const metadata: Metadata = {
  title: 'Documentação | Steel',
  description: 'Guias e referências para usar o Steel.',
  // Placeholder page: keep it out of the index until it has content.
  robots: NO_INDEX,
}

export default function DocsPage() {
  return <span>Docs</span>
}
