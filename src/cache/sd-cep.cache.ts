import type { SdCepAddress } from '@/types/sd-cep'
import { createKeyedCache } from './_cache'

/** Endereços do ViaCEP por CEP (8 dígitos). CEP muda raramente: 30 dias. */
export const SdCepCache = createKeyedCache<SdCepAddress>({
  prefix: 'sd:cep:',
  ttl: 30 * 24 * 60 * 60,
  name: 'sd_cep',
})
