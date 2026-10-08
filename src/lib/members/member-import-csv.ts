import { validationError } from '@/src/errors'
import {
  MEMBER_IMPORT_MAX_ROWS,
  type MemberImportRowDTO,
  MemberImportRowSchema,
} from '@/src/schemas/member.schema'
import { err, ok, type Result } from '../result'
import { csvToRecords, pickCsvValue } from '../servicedesk/csv'

const EMAIL_COLUMNS = ['email', 'e_mail'] as const
const ROLE_COLUMNS = ['role', 'papel', 'cargo'] as const

/** pt-BR labels (as the UI shows them) are accepted next to the enum. */
const ROLE_ALIASES: Record<string, string> = {
  ADMINISTRADOR: 'ADMIN',
  MEMBRO: 'MEMBER',
  VISUALIZADOR: 'VIEWER',
}

function normalizeRole(value: string | undefined): string | undefined {
  if (!value) return undefined
  const upper = value.trim().toUpperCase()
  return ROLE_ALIASES[upper] ?? upper
}

/**
 * Parses the member import spreadsheet: one invitation per row, column
 * `email` (or `e-mail`) required, `role`/`papel`/`cargo` optional (defaults
 * to MEMBER). Accepts `,` or `;` as delimiter. Any invalid row rejects the
 * whole file, so nothing is sent from a half-valid spreadsheet.
 */
export function parseMemberImportCsv(
  text: string,
): Result<MemberImportRowDTO[]> {
  const { headers, records } = csvToRecords(text)

  if (!EMAIL_COLUMNS.some((column) => headers.includes(column))) {
    return err(validationError('A planilha precisa de uma coluna "email"'))
  }
  if (records.length === 0) {
    return err(validationError('A planilha não tem nenhuma linha de dados'))
  }
  if (records.length > MEMBER_IMPORT_MAX_ROWS) {
    return err(
      validationError(
        `A planilha pode ter no máximo ${MEMBER_IMPORT_MAX_ROWS} linhas`,
      ),
    )
  }

  const rows: MemberImportRowDTO[] = []
  for (const [index, record] of records.entries()) {
    const parsed = MemberImportRowSchema.safeParse({
      email: pickCsvValue(record, EMAIL_COLUMNS)?.toLowerCase(),
      role: normalizeRole(pickCsvValue(record, ROLE_COLUMNS)),
    })
    if (!parsed.success) {
      // Line 1 is the header, so data row 0 is line 2 of the file.
      return err(
        validationError(
          `Linha ${index + 2} inválida: ${parsed.error.issues[0]?.message}`,
        ),
      )
    }
    rows.push(parsed.data)
  }

  return ok(rows)
}
