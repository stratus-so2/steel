import type { Metadata } from 'next'
import { SteelAiWelcome } from '@/app/_components/steel-ai/steel-ai-welcome'

export const metadata: Metadata = {
  title: 'Steel AI | Steel',
  description: 'Converse com o Steel AI para consultar e executar tarefas.',
}

export default function AiPage() {
  return <SteelAiWelcome />
}
