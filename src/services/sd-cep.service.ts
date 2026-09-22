import type { Result } from '@/src/lib/result'
import { lookupCep } from '@/src/lib/servicedesk/viacep'
import type { SdCepAddress } from '@/types/sd-cep'
import { SdAccess } from './sd-access'

export const SdCepService = {
  /** Consulta de CEP (ViaCEP + cache) para qualquer membro do ServiceDesk. */
  async lookup(
    actorId: string,
    workspaceId: string,
    cep: string,
  ): Promise<Result<SdCepAddress>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    return lookupCep(cep)
  },
}
