import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const entry = (frontmatter: string, body = '## Novidade\n\nTexto.') =>
  `---\n${frontmatter}\n---\n\n${body}\n`

const FRONTMATTER = (slug: string, date: string) =>
  `title: Entrada ${slug}\nslug: ${slug}\ndate: ${date}\nsummary: Resumo da entrada ${slug}.\ntags: [CRM]`

let root: string

async function loadWith(files: Record<string, string> | null) {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'steel-changelog-'))
  if (files) {
    const dir = path.join(root, 'content', 'changelog')
    await fs.mkdir(dir, { recursive: true })
    for (const [name, content] of Object.entries(files)) {
      await fs.writeFile(path.join(dir, name), content)
    }
  }
  vi.spyOn(process, 'cwd').mockReturnValue(root)
  vi.resetModules()
  return import('@/src/lib/changelog/entries')
}

describe('changelog entries', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (root) await fs.rm(root, { recursive: true, force: true })
  })

  it('lists the mdx entries newest first and ignores other files', async () => {
    const { getAllEntriesMeta } = await loadWith({
      'a.mdx': entry(FRONTMATTER('antiga', '2026-09-01')),
      'b.mdx': entry(FRONTMATTER('nova', '2026-10-01')),
      'c.mdx': entry(FRONTMATTER('mesmo-dia', '2026-10-01')),
      'notes.md': 'not an entry',
    })

    const entries = await getAllEntriesMeta()

    expect(entries.map((e) => e.slug)).toEqual(['mesmo-dia', 'nova', 'antiga'])
    expect(entries[0]).toEqual({
      slug: 'mesmo-dia',
      title: 'Entrada mesmo-dia',
      date: '2026-10-01T00:00:00.000Z',
      summary: 'Resumo da entrada mesmo-dia.',
      tags: ['CRM'],
      version: null,
      cover: null,
    })
    expect(entries[0]).not.toHaveProperty('source')
  })

  it('returns an empty list when the directory does not exist', async () => {
    const { getAllEntries } = await loadWith(null)
    await expect(getAllEntries()).resolves.toEqual([])
  })

  it('finds an entry by slug with its source and headings', async () => {
    const { getEntryBySlug } = await loadWith({
      'a.mdx': `---\n${FRONTMATTER('com-versao', '2026-10-08')}\nversion: 2026.10.08\ncover: /x.png\n---\n\n## Um\n\n### Dois\n`,
    })

    const found = await getEntryBySlug('com-versao')

    expect(found?.version).toBe('2026.10.08')
    expect(found?.cover).toBe('/x.png')
    expect(found?.source).toBe('## Um\n\n### Dois')
    expect(found?.headings).toEqual([
      { level: 2, id: 'um', text: 'Um' },
      { level: 3, id: 'dois', text: 'Dois' },
    ])
    await expect(getEntryBySlug('nope')).resolves.toBeNull()
  })

  it('fails loudly on invalid frontmatter', async () => {
    const { getAllEntries } = await loadWith({
      'bad.mdx': entry('title: x\nslug: Bad Slug'),
    })
    await expect(getAllEntries()).rejects.toThrow(
      'Invalid frontmatter in content/changelog/bad.mdx',
    )
  })

  it('fails loudly on a duplicate slug', async () => {
    const { getAllEntries } = await loadWith({
      'a.mdx': entry(FRONTMATTER('dup', '2026-10-01')),
      'b.mdx': entry(FRONTMATTER('dup', '2026-10-02')),
    })
    await expect(getAllEntries()).rejects.toThrow(
      'Duplicate changelog slug: dup',
    )
  })

  it('rethrows unexpected read errors', async () => {
    const { getAllEntries } = await loadWith(null)
    const denied = Object.assign(new Error('denied'), { code: 'EACCES' })
    vi.spyOn(fs, 'readdir').mockRejectedValueOnce(denied)
    await expect(getAllEntries()).rejects.toThrow('denied')
  })
})

describe('extractHeadings', () => {
  it('slugs like rehype-slug, dedupes, strips markup and skips code fences', async () => {
    const { extractHeadings } = await import('@/src/lib/changelog/entries')
    const source = [
      '# Título não entra',
      '## Busca **global**',
      '```md',
      '## não é heading',
      '```',
      '## Busca global',
      '#### fundo demais',
      '### Ctrl+K ##',
    ].join('\n')

    expect(extractHeadings(source)).toEqual([
      { level: 2, id: 'busca-global', text: 'Busca global' },
      { level: 2, id: 'busca-global-1', text: 'Busca global' },
      { level: 3, id: 'ctrlk', text: 'Ctrl+K' },
    ])
  })
})

describe('repository content', () => {
  it('every content/changelog entry parses', async () => {
    vi.resetModules()
    const { getAllEntries } = await import('@/src/lib/changelog/entries')
    const entries = await getAllEntries()
    expect(entries.length).toBeGreaterThan(0)
  })
})
