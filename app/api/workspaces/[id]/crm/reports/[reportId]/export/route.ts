import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { toCsv, toSpreadsheetML } from '@/src/lib/crm-export'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmReportService } from '@/src/services/crm-report.service'
import { handleError } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; reportId: string }> }

/** Exporta o relatório processado em CSV (default) ou Excel (?format=xlsx). */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, reportId } = await ctx.params

  const result = await CrmReportService.runData(
    auth.value.user.id,
    id,
    reportId,
  )
  if (!result.ok) return handleError(result.error)

  // `toCsv`/`toSpreadsheetML` usam a coluna como cabeçalho e como chave da
  // linha, então remapeamos as linhas para serem indexadas pelo rótulo amigável.
  const headers = result.value.columns.map((c) => c.label)
  const rows = result.value.rows.map((row) =>
    Object.fromEntries(result.value.columns.map((c) => [c.label, row[c.key]])),
  )
  const format = request.nextUrl.searchParams.get('format')

  if (format === 'xlsx' || format === 'excel') {
    const body = toSpreadsheetML(headers, rows)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': 'attachment; filename="relatorio.xls"',
      },
    })
  }

  const body = toCsv(headers, rows)
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="relatorio.csv"',
    },
  })
})
