import type { Metadata } from 'next'
import { SteelAiComingSoon } from '@/app/_components/steel-ai-usage/steel-ai-coming-soon'

export const metadata: Metadata = {
  title: 'Memória | Steel AI | Steel',
  description: 'O que o Steel AI lembra sobre você e o espaço de trabalho.',
}

/** Placeholder until the memory slice ships this page. */
export default function SteelAiMemoryPage() {
  return (
    <SteelAiComingSoon
      segment='memory'
      description='O que o Steel AI lembra sobre você e sobre o espaço de trabalho, para revisar e apagar. Esta área chega em breve.'
    />
  )
}
