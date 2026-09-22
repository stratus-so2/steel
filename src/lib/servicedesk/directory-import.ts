import { pickCsvValue } from './csv'

/**
 * Mapeamento das colunas da planilha (cabeçalhos normalizados por
 * `normalizeCsvHeader`) para os campos dos cadastros. Aceita os nomes mais
 * comuns em pt-BR e em inglês.
 */

export const SD_CUSTOMER_IMPORT_COLUMNS = {
  name: ['nome', 'razao_social', 'nome_razao_social', 'name'],
  tradeName: ['fantasia', 'nome_fantasia', 'trade_name'],
  document: ['documento', 'cpf_cnpj', 'cnpj', 'cpf', 'document'],
  email: ['email', 'e_mail'],
  phone: ['telefone', 'fone', 'phone'],
  whatsapp: ['whatsapp', 'celular', 'zap'],
  zipCode: ['cep', 'zip_code'],
  street: ['logradouro', 'endereco', 'rua', 'street'],
  number: ['numero', 'nro', 'number'],
  complement: ['complemento', 'complement'],
  district: ['bairro', 'district'],
  city: ['cidade', 'municipio', 'city'],
  state: ['uf', 'estado', 'state'],
  ibgeCode: ['ibge', 'codigo_ibge'],
  notes: ['observacoes', 'obs', 'notas', 'notes'],
} as const

export const SD_CONTACT_IMPORT_COLUMNS = {
  name: ['nome', 'name'],
  jobTitle: ['cargo', 'funcao', 'job_title'],
  email: ['email', 'e_mail'],
  phone: ['telefone', 'fone', 'phone'],
  whatsapp: ['whatsapp', 'celular', 'zap'],
  notes: ['observacoes', 'obs', 'notas', 'notes'],
  /** CPF/CNPJ do cliente/empresa a vincular (como principal). */
  customerDocument: [
    'documento_cliente',
    'cliente_documento',
    'cnpj_cliente',
    'cpf_cnpj_cliente',
    'cnpj_empresa',
    'customer_document',
  ],
} as const

type Mapped<T extends Record<string, readonly string[]>> = {
  [K in keyof T]?: string
}

function mapRecord<T extends Record<string, readonly string[]>>(
  columns: T,
  record: Record<string, string>,
): Mapped<T> {
  const out: Mapped<T> = {}
  for (const key of Object.keys(columns) as (keyof T)[]) {
    const value = pickCsvValue(record, columns[key])
    if (value !== undefined) out[key] = value
  }
  return out
}

export function mapSdCustomerImportRecord(record: Record<string, string>) {
  return mapRecord(SD_CUSTOMER_IMPORT_COLUMNS, record)
}

export function mapSdContactImportRecord(record: Record<string, string>) {
  return mapRecord(SD_CONTACT_IMPORT_COLUMNS, record)
}
