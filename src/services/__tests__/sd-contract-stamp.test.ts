import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/sd-contract.repository')
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { SdContractRepository } from '@/src/repositories/sd-contract.repository'
import { resolveSdTicketContractId } from '../sd-contract-stamp'

const repo = vi.mocked(SdContractRepository)
const warn = vi.mocked(logger.warn)
const AT = new Date('2026-10-07T12:00:00.000Z')

beforeEach(() => {
  repo.findActiveForCustomer.mockResolvedValue(ok({ id: 'ct1' }))
})

describe('resolveSdTicketContractId', () => {
  it('devolve o contrato vigente do cliente', async () => {
    expect(await resolveSdTicketContractId('ws1', 'cus1', 'INCIDENT', AT)).toBe(
      'ct1',
    )
    expect(repo.findActiveForCustomer).toHaveBeenCalledWith(
      'ws1',
      'cus1',
      'INCIDENT',
      AT,
    )
  })

  it('chamado sem cliente nem consulta o banco', async () => {
    expect(
      await resolveSdTicketContractId('ws1', null, 'INCIDENT', AT),
    ).toBeNull()
    expect(
      await resolveSdTicketContractId('ws1', undefined, 'INCIDENT', AT),
    ).toBeNull()
    expect(repo.findActiveForCustomer).not.toHaveBeenCalled()
  })

  it('cliente sem contrato vigente devolve nulo', async () => {
    repo.findActiveForCustomer.mockResolvedValue(ok(null))
    expect(
      await resolveSdTicketContractId('ws1', 'cus1', 'CHANGE', AT),
    ).toBeNull()
  })

  it('falha de banco não interrompe a abertura — só registra o aviso', async () => {
    repo.findActiveForCustomer.mockResolvedValue(err(databaseError()))
    expect(
      await resolveSdTicketContractId('ws1', 'cus1', 'PROBLEM', AT),
    ).toBeNull()
    expect(warn).toHaveBeenCalledWith(
      'servicedesk.contract.stamp_failed',
      expect.objectContaining({ workspaceId: 'ws1', customerId: 'cus1' }),
    )
  })
})
