import { describe, expect, it } from 'vitest'
import { firstWikiPageId, wikiAncestors } from '@/src/lib/wiki-tree'

const page = (id: string, parentId: string | null, position = 0) => ({
  id,
  parentId,
  position,
  title: id,
})

describe('firstWikiPageId', () => {
  it('returns null for an empty wiki', () => {
    expect(firstWikiPageId([])).toBeNull()
  })

  it('opens the first root page by position, never a child', () => {
    expect(
      firstWikiPageId([
        page('child', 'b', 0),
        page('b', null, 2),
        page('a', null, 1),
      ]),
    ).toBe('a')
  })

  it('treats a page whose parent is gone as a root', () => {
    expect(firstWikiPageId([page('orphan', 'missing', 3)])).toBe('orphan')
  })

  it('still opens a page when every page is in a parent cycle', () => {
    expect(firstWikiPageId([page('x', 'y', 1), page('y', 'x', 0)])).toBe('y')
  })
})

describe('wikiAncestors', () => {
  const pages = [
    page('root', null),
    page('mid', 'root'),
    page('leaf', 'mid'),
    page('lost', 'missing'),
    page('c1', 'c2'),
    page('c2', 'c1'),
  ]

  it('lists the parents root first', () => {
    expect(wikiAncestors(pages, 'leaf').map((p) => p.id)).toEqual([
      'root',
      'mid',
    ])
  })

  it('is empty for a root, an unknown page or a missing parent', () => {
    expect(wikiAncestors(pages, 'root')).toEqual([])
    expect(wikiAncestors(pages, 'nope')).toEqual([])
    expect(wikiAncestors(pages, 'lost')).toEqual([])
  })

  it('stops at a parent cycle', () => {
    expect(wikiAncestors(pages, 'c1').map((p) => p.id)).toEqual(['c2'])
  })
})
