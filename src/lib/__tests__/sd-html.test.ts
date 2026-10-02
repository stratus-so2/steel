import { describe, expect, it } from 'vitest'
import {
  escapeSdHtmlText,
  sanitizeSdHtml,
  sdHtmlToText,
} from '@/src/lib/servicedesk/html'

describe('escapeSdHtmlText', () => {
  it('escapes the five characters that break out of HTML', () => {
    expect(escapeSdHtmlText(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('escapes the ampersand first, so entities are not double-escaped', () => {
    expect(escapeSdHtmlText('a & b < c')).toBe('a &amp; b &lt; c')
    expect(escapeSdHtmlText('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;')
  })

  it('neutralises a script tag injected in plain text', () => {
    expect(escapeSdHtmlText('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('leaves text without special characters untouched', () => {
    expect(escapeSdHtmlText('CPU alta no SRV-01')).toBe('CPU alta no SRV-01')
    expect(escapeSdHtmlText('')).toBe('')
  })
})

describe('sanitizeSdHtml', () => {
  it('keeps allowed formatting', () => {
    const html =
      '<p>Olá <strong>mundo</strong> <em>x</em><br/><a href="https://steel.app/x" target="_blank">link</a></p><ul><li>a</li></ul>'
    expect(sanitizeSdHtml(html)).toBe(
      '<p>Olá <strong>mundo</strong> <em>x</em><br><a href="https://steel.app/x" target="_blank" rel="noopener noreferrer">link</a></p><ul><li>a</li></ul>',
    )
  })

  it('removes scripts, styles and iframes with their content', () => {
    expect(
      sanitizeSdHtml(
        '<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"><p>in</p></iframe><p>b</p>',
      ),
    ).toBe('<p>a</p><p>b</p>')
    expect(sanitizeSdHtml('<svg><svg></svg>x</svg>ok')).toBe('ok')
    expect(sanitizeSdHtml('<script/>ok')).toBe('ok')
    expect(sanitizeSdHtml('<p>a<script>never closed')).toBe('<p>a')
  })

  it('unwraps unknown tags keeping the text', () => {
    expect(sanitizeSdHtml('<form><button>Enviar</button></form>')).toBe(
      'Enviar',
    )
  })

  it('drops event handlers, styles and unknown attributes', () => {
    expect(
      sanitizeSdHtml(
        '<p onclick="x()" style="color:red" class="c" data-x=1 title=\'t\'>x</p>',
      ),
    ).toBe('<p class="c" title="t">x</p>')
  })

  it.each([
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="&#x6A;avascript&colon;alert(1)">x</a>',
    '<a href="vbscript:x">x</a>',
    '<a href="data:text/html,<b>">x</a>',
    '<a href="">x</a>',
  ])('blocks dangerous urls: %s', (html) => {
    expect(sanitizeSdHtml(html)).toBe('<a>x</a>')
  })

  it('keeps safe urls', () => {
    expect(sanitizeSdHtml('<a href="mailto:a@b.com">m</a>')).toBe(
      '<a href="mailto:a@b.com">m</a>',
    )
    expect(sanitizeSdHtml('<a href="/x?a=1&amp;b=2">r</a>')).toBe(
      '<a href="/x?a=1&amp;b=2">r</a>',
    )
    expect(sanitizeSdHtml('<a href="exemplo.com/x" target="_self">r</a>')).toBe(
      '<a href="exemplo.com/x">r</a>',
    )
    expect(
      sanitizeSdHtml(
        '<img src="data:image/png;base64,AAAA" alt="a" onerror="x">',
      ),
    ).toBe('<img src="data:image/png;base64,AAAA" alt="a">')
    expect(sanitizeSdHtml('<img src="data:image/svg+xml;base64,AAAA">')).toBe(
      '<img>',
    )
  })

  it('escapes stray angle brackets and removes comments/doctype/cdata/pi', () => {
    expect(
      sanitizeSdHtml(
        '<!DOCTYPE html><!-- c --><![CDATA[x]]><?xml x?>1 < 2 > 0 <p>ok</p>',
      ),
    ).toBe('1 &lt; 2 &gt; 0 <p>ok</p>')
    expect(sanitizeSdHtml('fim <')).toBe('fim &lt;')
  })

  it('escapes quotes inside attributes and keeps table attributes', () => {
    expect(sanitizeSdHtml('<td colspan="2" title=\'a"b\'>x</td>')).toBe(
      '<td colspan="2" title="a&quot;b">x</td>',
    )
  })

  it('ignores closing void tags', () => {
    expect(sanitizeSdHtml('a<br></br>b')).toBe('a<br>b')
  })

  it('keeps valueless allowed attributes as empty', () => {
    expect(sanitizeSdHtml('<p title>x</p>')).toBe('<p title="">x</p>')
  })
})

describe('sdHtmlToText', () => {
  it('extracts readable text', () => {
    expect(
      sdHtmlToText(
        '<h1>Título</h1><p>Linha &amp; 1<br>Linha 2</p><script>x</script><p>a &lt; b</p><p></p><p></p><p></p>',
      ),
    ).toBe('Título\nLinha & 1\nLinha 2\na < b')
    expect(sdHtmlToText('<p title="&quot;">"x"</p>')).toBe('"x"')
  })
})
