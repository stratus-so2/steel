/** Endereço resolvido pelo ViaCEP (`GET /servicedesk/cep/{cep}`). */
export interface SdCepAddress {
  /** 8 dígitos, sem máscara. */
  zipCode: string
  street: string | null
  complement: string | null
  district: string | null
  city: string | null
  /** UF (2 letras). */
  state: string | null
  /** Código IBGE do município (7 dígitos). */
  ibgeCode: string | null
}
