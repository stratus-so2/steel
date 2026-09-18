'use client'

import { useIsPrivileged } from '@/app/_components/workspace/workspace-permissions'

/**
 * Aviso no editor de uma proposta expirada. Estender a validade é ação de
 * OWNER/ADMIN: basta escolher uma nova data futura no campo "Validade".
 */
export function ProposalExpiredHint() {
  const isPrivileged = useIsPrivileged()
  return (
    <p
      role='status'
      className='rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-400'
    >
      Proposta expirada — o cliente não consegue mais aceitá-la.{' '}
      {isPrivileged
        ? 'Escolha uma nova data de validade (futura) para reativá-la.'
        : 'Peça a um administrador do CRM para estender a validade.'}
    </p>
  )
}
