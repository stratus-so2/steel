import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { readZip } from '@/src/__tests__/helpers/zip-reader'
import { CSV_BOM, csvCell, csvDocument, csvRow } from '../csv-writer'
import {
  buildDataArchive,
  REDACTED,
  redactRow,
  rowsToCsv,
  SECRET_FIELD,
} from '../workspace-export/data-archive'
import {
  LOG_COLUMNS,
  LOGS_MAX_ROWS,
  logRowsToCsv,
  logRowsToNdjson,
  logsReadMe,
  resolveWorkspaceLogsConfig,
  workspaceLogsApl,
} from '../workspace-export/logs'
import {
  EXPORT_RETENTION_DAYS,
  exportDayKey,
  exportExpiry,
  formatExportInstant,
  nextExportSlot,
} from '../workspace-export/policy'
import { createZip, dosDateTime } from '../zip'

describe('csv writer', () => {
  it('escapes separators, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""')
    expect(csvCell('linha\nnova')).toBe('"linha\nnova"')
    expect(csvCell('simples')).toBe('simples')
  })

  it('neutralizes formulas but keeps numbers numeric', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('@user')).toBe("'@user")
    expect(csvCell('-10')).toBe("'-10")
    expect(csvCell(-10)).toBe('-10')
    expect(csvCell(1.5)).toBe('1.5')
    expect(csvCell(Number.NaN)).toBe('')
  })

  it('writes booleans, nulls and whole documents', () => {
    expect(csvCell(true)).toBe('true')
    expect(csvCell(false)).toBe('false')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvRow(['a', 1, null])).toBe('a,1,\r\n')
    expect(csvDocument(['x', 'y'], [[1, 'b']])).toBe(`${CSV_BOM}x,y\r\n1,b\r\n`)
  })
})

describe('zip writer', () => {
  it('round-trips UTF-8 names and contents', () => {
    const zip = createZip(
      [
        { name: 'LEIA-ME.txt', data: 'Exportação ✓' },
        { name: 'json/tabela.json', data: Buffer.from('[1,2,3]') },
        { name: 'vazio.txt', data: '' },
      ],
      new Date('2026-10-08T12:34:56.000Z'),
    )
    const files = readZip(zip)
    expect([...files.keys()]).toEqual([
      'LEIA-ME.txt',
      'json/tabela.json',
      'vazio.txt',
    ])
    expect(files.get('LEIA-ME.txt')).toBe('Exportação ✓')
    expect(files.get('json/tabela.json')).toBe('[1,2,3]')
    expect(files.get('vazio.txt')).toBe('')
  })

  it('stamps MS-DOS dates and clamps years before 1980', () => {
    const stamp = dosDateTime(new Date('2026-10-08T12:34:56.000Z'))
    expect(stamp.date).toBe(((2026 - 1980) << 9) | (10 << 5) | 8)
    expect(stamp.time).toBe((12 << 11) | (34 << 5) | 28)
    expect(dosDateTime(new Date('1970-01-01T00:00:00.000Z')).date).toBe(
      (1 << 5) | 1,
    )
  })

  it('refuses more entries than the classic format allows', () => {
    const entries = Array.from({ length: 0x10000 }, (_, i) => ({
      name: `${i}`,
      data: '',
    }))
    expect(() => createZip(entries)).toThrow('at most 65535 entries')
  })
})

describe('export policy', () => {
  it('uses the São Paulo day for the daily slot', () => {
    // 01:30 UTC on the 9th is still the 8th in São Paulo (UTC-3).
    const at = new Date('2026-10-09T01:30:00.000Z')
    expect(exportDayKey(at)).toBe('2026-10-08')
    expect(nextExportSlot(at).toISOString()).toBe('2026-10-09T03:00:00.000Z')
  })

  it('keeps files for the retention window and formats instants in pt-BR', () => {
    const done = new Date('2026-10-08T15:00:00.000Z')
    expect(exportExpiry(done).getTime() - done.getTime()).toBe(
      EXPORT_RETENTION_DAYS * 86_400_000,
    )
    expect(formatExportInstant(new Date('2026-10-09T03:00:00.000Z'))).toBe(
      '09/10/2026, 00:00',
    )
  })
})

describe('data archive', () => {
  it('flags only secret-looking columns', () => {
    for (const name of [
      'encryptedPassword',
      'webhookSecret',
      'secret',
      'password',
      'accessToken',
      'shareToken',
      'tokenHash',
      'keyHash',
      'sessionHash',
      'token',
    ]) {
      expect(SECRET_FIELD.test(name), name).toBe(true)
    }
    for (const name of [
      'inputTokens',
      'tokenExpiresAt',
      'name',
      'storageKey',
    ]) {
      expect(SECRET_FIELD.test(name), name).toBe(false)
    }
  })

  it('redacts non-empty secrets and records the field', () => {
    const redacted = new Set<string>()
    expect(
      redactRow(
        { id: '1', accessToken: 'abc', refreshToken: null, name: 'X' },
        redacted,
      ),
    ).toEqual({ id: '1', accessToken: REDACTED, refreshToken: null, name: 'X' })
    expect([...redacted]).toEqual(['accessToken'])
  })

  it('writes heterogeneous rows as CSV with the union of columns', () => {
    const csv = rowsToCsv([
      { a: 1, when: new Date('2026-10-01T00:00:00.000Z') },
      {
        a: 2,
        b: { nested: true },
        big: BigInt(5),
        money: new Prisma.Decimal('10.50'),
        list: ['x'],
        none: undefined,
        flag: false,
      },
    ])
    const lines = csv.replace(CSV_BOM, '').trim().split('\r\n')
    expect(lines[0]).toBe('a,when,b,big,money,list,none,flag')
    expect(lines[1]).toBe('1,2026-10-01T00:00:00.000Z,,,,,,')
    expect(lines[2]).toBe('2,,"{""nested"":true}",5,10.5,"[""x""]",,false')
  })

  it('builds read-me, manifest, and JSON + CSV per non-empty table', () => {
    const archive = buildDataArchive({
      workspace: { id: 'ws1', name: 'Acme', slug: 'acme' },
      tables: {
        whatsAppConnection: [
          { id: 'c1', encryptedToken: 'zzz', size: BigInt(3) },
        ],
        crmTask: [],
        sdTicket: [{ id: 't1', title: 'Falha' }],
      },
      exportedAt: new Date('2026-10-08T12:00:00.000Z'),
      requestedBy: { name: 'Ana', email: 'ana@acme.test' },
    })
    const names = archive.entries.map((e) => e.name)
    expect(names).toEqual([
      'LEIA-ME.txt',
      'manifest.json',
      'json/sdTicket.json',
      'csv/sdTicket.csv',
      'json/whatsAppConnection.json',
      'csv/whatsAppConnection.csv',
    ])
    expect(archive.totalRows).toBe(2)
    expect(archive.redactedFields).toEqual(['encryptedToken'])
    expect(archive.tables).toEqual([
      { name: 'crmTask', rows: 0 },
      { name: 'sdTicket', rows: 1 },
      { name: 'whatsAppConnection', rows: 1 },
    ])
    const json = archive.entries.find(
      (e) => e.name === 'json/whatsAppConnection.json',
    )
    expect(JSON.parse(json?.data as string)).toEqual([
      { id: 'c1', encryptedToken: REDACTED, size: '3' },
    ])
    const readme = archive.entries[0].data as string
    expect(readme).toContain('Ana <ana@acme.test>')
    const manifest = JSON.parse(archive.entries[1].data as string)
    expect(manifest.workspace.slug).toBe('acme')
  })

  it('credits the system when nobody requested it and tolerates a missing table', () => {
    const archive = buildDataArchive({
      workspace: { id: 'ws1', name: 'Acme', slug: 'acme' },
      tables: { ghost: undefined as unknown as unknown[] },
      exportedAt: new Date('2026-10-08T12:00:00.000Z'),
      requestedBy: null,
    })
    expect(archive.entries[0].data).toContain('a pedido de sistema')
    expect(archive.tables).toEqual([{ name: 'ghost', rows: 0 }])
  })
})

describe('logs export', () => {
  it('is configured only with a query token and a dataset', () => {
    expect(resolveWorkspaceLogsConfig({})).toEqual({
      configured: false,
      url: 'https://api.axiom.co',
      dataset: '',
    })
    expect(
      resolveWorkspaceLogsConfig({ token: 'xaat-1', dataset: '' }).configured,
    ).toBe(false)
    expect(
      resolveWorkspaceLogsConfig({
        token: 'xaat-1',
        dataset: 'steel',
        url: 'https://eu.axiom.co',
      }),
    ).toEqual({
      configured: true,
      token: 'xaat-1',
      url: 'https://eu.axiom.co',
      dataset: 'steel',
    })
  })

  it('reads the module env when called without arguments', () => {
    expect(resolveWorkspaceLogsConfig().url).toBeTruthy()
  })

  it('filters by the workspace on request and app fields, newest first', () => {
    const apl = workspaceLogsApl("steel'app", 'ws"1', 10.7)
    expect(apl.startsWith("['steelapp']")).toBe(true)
    expect(apl).toContain(
      `where ws_request == "ws\\"1" or ws_fields == "ws\\"1"`,
    )
    expect(apl).toContain("column_ifexists('request.workspaceId', '')")
    expect(apl).toContain("column_ifexists('fields.workspaceId', '')")
    expect(apl).toContain('| sort by time desc')
    expect(apl).toContain('| limit 10')
    expect(workspaceLogsApl('d', 'w', 0)).toContain('| limit 1')
    expect(workspaceLogsApl('d', 'w')).toContain(`| limit ${LOGS_MAX_ROWS}`)
  })

  it('writes CSV and NDJSON with only the known columns', () => {
    const rows = [
      {
        time: '2026-10-08T10:00:00Z',
        level: 'info',
        path: '/api/x',
        status: 200,
        extra: 'ignored',
      },
      { time: '2026-10-08T11:00:00Z', category: 'audit', entity: '' },
    ]
    const csv = logRowsToCsv(rows).replace(CSV_BOM, '').trim().split('\r\n')
    expect(csv[0]).toBe(LOG_COLUMNS.join(','))
    expect(csv[1]).toBe('2026-10-08T10:00:00Z,info,,,,/api/x,200,,,,,,,,')
    const ndjson = logRowsToNdjson(rows).trim().split('\n')
    expect(JSON.parse(ndjson[0])).toEqual({
      time: '2026-10-08T10:00:00Z',
      level: 'info',
      path: '/api/x',
      status: '200',
    })
    expect(JSON.parse(ndjson[1])).toEqual({
      time: '2026-10-08T11:00:00Z',
      category: 'audit',
    })
  })

  it('explains truncation in the read-me', () => {
    const base = {
      workspaceName: 'Acme',
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-08T00:00:00.000Z'),
    }
    expect(logsReadMe({ ...base, rows: 3, truncated: false })).toContain(
      'Eventos: 3.',
    )
    expect(
      logsReadMe({ ...base, rows: LOGS_MAX_ROWS, truncated: true }),
    ).toContain('limite de 50000 atingido')
  })
})
