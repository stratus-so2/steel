import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Criar workspace | Steel',
  description: 'Crie um novo workspace para o seu time no Steel.',
}

export default function CreateWorkspaceLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
