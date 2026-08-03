// Modelo de planilha padrão (CSV): telefone, nome (opcional),
// data_referencia, var_1..var_N — N é o número de variáveis do BODY do
// template Meta escolhido. CSV em vez de .xlsx binário: cobre o caso de uso
// (exportação de sistema de terceiro) sem puxar uma dependência de parsing
// binário nova (risco de supply chain) para um formato que qualquer
// planilha exporta nativamente.

export interface BroadcastImportRow {
  phone: string
  contactName?: string
  referenceDate: string
  variables: string[]
}

export interface ParsedBroadcastImportCsv {
  rows: BroadcastImportRow[]
  parseErrors: string[]
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export function parseBroadcastImportCsv(
  csvText: string,
): ParsedBroadcastImportCsv {
  const lines = csvText
    .split(/\r\n|\n/)
    .filter((line) => line.trim().length > 0)
  if (lines.length < 2) {
    return { rows: [], parseErrors: ['Arquivo vazio ou sem linhas de dados'] }
  }

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const phoneIndex = header.indexOf('telefone')
  const dateIndex = header.indexOf('data_referencia')
  const nameIndex = header.indexOf('nome')

  if (phoneIndex === -1 || dateIndex === -1) {
    return {
      rows: [],
      parseErrors: [
        'Cabeçalho deve conter as colunas "telefone" e "data_referencia"',
      ],
    }
  }

  const variableIndexes = header
    .map((h, index) => ({ h, index }))
    .filter(({ h }) => /^var_\d+$/.test(h))
    .sort((a, b) => Number(a.h.slice(4)) - Number(b.h.slice(4)))
    .map(({ index }) => index)

  const rows: BroadcastImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const columns = splitCsvLine(lines[i])
    rows.push({
      phone: (columns[phoneIndex] ?? '').trim(),
      contactName:
        nameIndex !== -1 ? (columns[nameIndex] ?? '').trim() : undefined,
      referenceDate: (columns[dateIndex] ?? '').trim(),
      variables: variableIndexes.map((index) => (columns[index] ?? '').trim()),
    })
  }

  return { rows, parseErrors: [] }
}

export interface ValidatedBroadcastImportRow {
  rowNumber: number
  phone: string
  contactName?: string
  scheduledAt: Date
  // Data/hora real do compromisso (ex: exame) — distinta de `scheduledAt`
  // (horário de disparo do lembrete). Persistida pra a IA poder consultar
  // via tool calling quando o cliente pergunta sobre agendamentos.
  appointmentAt: Date
  variableValues: { body: Record<string, string> }
}

export interface RejectedBroadcastImportRow {
  rowNumber: number
  reason: string
}

export interface BroadcastImportValidationResult {
  valid: ValidatedBroadcastImportRow[]
  rejected: RejectedBroadcastImportRow[]
}

const PHONE_PATTERN = /^\d{10,15}$/

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function validateBroadcastImportRows(
  rows: BroadcastImportRow[],
  bodyVariableCount: number,
  sendOffsetHours: number,
): BroadcastImportValidationResult {
  const valid: ValidatedBroadcastImportRow[] = []
  const rejected: RejectedBroadcastImportRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 1
    const phone = normalizePhone(row.phone)

    if (!PHONE_PATTERN.test(phone)) {
      rejected.push({
        rowNumber,
        reason: `Telefone inválido: "${row.phone}"`,
      })
      return
    }

    const referenceDate = new Date(row.referenceDate)
    if (Number.isNaN(referenceDate.getTime())) {
      rejected.push({
        rowNumber,
        reason: `Data de referência inválida: "${row.referenceDate}"`,
      })
      return
    }

    if (row.variables.length !== bodyVariableCount) {
      rejected.push({
        rowNumber,
        reason: `Template exige ${bodyVariableCount} variável(is), a linha tem ${row.variables.length}`,
      })
      return
    }

    if (row.variables.some((value) => !value)) {
      rejected.push({
        rowNumber,
        reason: 'Uma ou mais variáveis estão em branco',
      })
      return
    }

    const scheduledAt = new Date(
      referenceDate.getTime() - sendOffsetHours * 60 * 60 * 1000,
    )
    const body: Record<string, string> = {}
    row.variables.forEach((value, i) => {
      body[String(i + 1)] = value
    })

    valid.push({
      rowNumber,
      phone,
      contactName: row.contactName || undefined,
      scheduledAt,
      appointmentAt: referenceDate,
      variableValues: { body },
    })
  })

  return { valid, rejected }
}
