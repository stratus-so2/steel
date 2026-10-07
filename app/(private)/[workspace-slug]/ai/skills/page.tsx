import type { Metadata } from 'next'
import { SteelAiComingSoon } from '@/app/_components/steel-ai-usage/steel-ai-coming-soon'

export const metadata: Metadata = {
  title: 'Skills | Steel AI | Steel',
  description: 'Instruções reutilizáveis do Steel AI.',
}

/** Placeholder until the skills slice ships this page. */
export default function SteelAiSkillsPage() {
  return (
    <SteelAiComingSoon
      segment='skills'
      description='Instruções reutilizáveis que você chama com / no Steel AI, como /meu-trabalho. Esta área chega em breve.'
    />
  )
}
