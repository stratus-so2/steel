/** Página de uma listagem dos cadastros do ServiceDesk. */
export interface SdPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Item dos seletores leves (combobox): cliente, contato ou CI. */
export interface SdOptionDTO {
  id: string
  label: string
  sublabel: string | null
}

/** Valores de campos customizados (`{ chave: valor }`). */
export type SdCustomFieldValuesDTO = Record<
  string,
  string | number | boolean | null | (string | number | boolean | null)[]
>

/** Chamado resumido exibido nas abas "Chamados" dos cadastros. */
export interface SdLinkedTicketDTO {
  id: string
  number: number
  type: 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE' | 'PROBLEM'
  title: string
  phaseName: string
  phaseCategory:
    | 'NEW'
    | 'IN_PROGRESS'
    | 'WAITING'
    | 'RESOLVED'
    | 'CLOSED'
    | 'CANCELED'
  createdAt: string
}
