import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/sd-approval-round.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')

import { SdApprovalRoundRepository } from '@/src/repositories/sd-approval-round.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { sdTicketApprovalSatisfied } from '../sd-approval-gate'

const rounds = vi.mocked(SdApprovalRoundRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)

beforeEach(() => {
  rounds.hasApprovedRound.mockResolvedValue(ok(false))
  ctxRepo.findLatestStandaloneApprovalStatus.mockResolvedValue(ok(null))
})

describe('sdTicketApprovalSatisfied', () => {
  it('accepts an approved CAB round without reading the standalone request', async () => {
    rounds.hasApprovedRound.mockResolvedValue(ok(true))
    expect(expectOk(await sdTicketApprovalSatisfied('t1'))).toBe(true)
    expect(ctxRepo.findLatestStandaloneApprovalStatus).not.toHaveBeenCalled()
  })

  it('accepts an approved standalone request', async () => {
    ctxRepo.findLatestStandaloneApprovalStatus.mockResolvedValue(ok('APPROVED'))
    expect(expectOk(await sdTicketApprovalSatisfied('t1'))).toBe(true)
  })

  it('refuses when there is no approval at all', async () => {
    expect(expectOk(await sdTicketApprovalSatisfied('t1'))).toBe(false)
  })

  it.each([
    'PENDING',
    'REJECTED',
    'EXPIRED',
  ] as const)('refuses a %s standalone request', async (status) => {
    ctxRepo.findLatestStandaloneApprovalStatus.mockResolvedValue(ok(status))
    expect(expectOk(await sdTicketApprovalSatisfied('t1'))).toBe(false)
  })

  it('propagates db errors from both reads', async () => {
    rounds.hasApprovedRound.mockResolvedValue(err(databaseError()))
    expectErr(await sdTicketApprovalSatisfied('t1'), 'DATABASE_ERROR')
    rounds.hasApprovedRound.mockResolvedValue(ok(false))
    ctxRepo.findLatestStandaloneApprovalStatus.mockResolvedValue(
      err(databaseError()),
    )
    expectErr(await sdTicketApprovalSatisfied('t1'), 'DATABASE_ERROR')
  })
})
