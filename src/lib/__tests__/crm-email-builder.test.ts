import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIMARY_COLOR,
  luminance,
  readableTextOn,
  resolveEmailBrand,
  tint,
} from '@/src/lib/crm-email-builder/brand'
import { SECTION_FIELDS } from '@/src/lib/crm-email-builder/fields'
import {
  canMoveSection,
  createBuilderDocument,
  EMAIL_LAYOUT_LIST,
  EMAIL_LAYOUTS,
  getLayoutSection,
  moveSection,
  SECTION_TYPE_LABEL,
  validateLayoutStructure,
} from '@/src/lib/crm-email-builder/layouts'
import {
  personalizeEmail,
  renderBuilderEmail,
} from '@/src/lib/crm-email-builder/render'
import {
  normalizeRichText,
  richTextToPlain,
  sanitizeRichText,
  styleRichText,
} from '@/src/lib/crm-email-builder/rich-text'
import {
  applyVariables,
  CAMPAIGN_LINK,
  contactToVariables,
  EMAIL_VARIABLES,
  escapeHtml,
  extractVariables,
  fixHrefQuerySeparators,
  fixTextQuerySeparators,
  SAMPLE_CONTACT,
} from '@/src/lib/crm-email-builder/variables'
import {
  EMAIL_BUILDER_SECTION_TYPES,
  type EmailBuilderDocument,
  EmailBuilderDocumentSchema,
  type EmailBuilderSection,
} from '@/src/schemas/crm-email-builder.schema'

const brand = {
  companyName: 'Acme',
  logoUrl: '',
  primaryColor: '#2893CC',
  address: 'Rua das Flores, 10 — São Paulo',
  website: 'https://acme.com.br/',
}

function withSection(
  doc: EmailBuilderDocument,
  id: string,
  patch: (s: EmailBuilderSection) => EmailBuilderSection,
): EmailBuilderDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => (s.id === id ? patch(s) : s)),
  }
}

describe('crm-email-builder variables', () => {
  it('maps a contact to variables, splitting the first name', () => {
    expect(
      contactToVariables(SAMPLE_CONTACT, {
        campaignLink: 'https://c',
        unsubscribeUrl: 'https://u',
      }),
    ).toEqual({
      nome: 'Maria Silva',
      primeiro_nome: 'Maria',
      email: 'maria.silva@exemplo.com.br',
      empresa: 'Acme Ltda.',
      cargo: 'Gerente de compras',
      telefone: '(11) 98765-4321',
      cidade: 'São Paulo',
      campaign_link: 'https://c',
      unsubscribe_url: 'https://u',
    })
  })

  it('fills missing contact fields with empty strings', () => {
    const values = contactToVariables({ email: 'a@b.com' })
    expect(values.nome).toBe('')
    expect(values.primeiro_nome).toBe('')
    expect(values.empresa).toBe('')
    expect(values.campaign_link).toBe('')
  })

  it('escapes values in html mode and keeps them raw in text mode', () => {
    const values = { nome: 'Tom & <Jerry>' }
    expect(applyVariables('Oi {{nome}}', values, 'html')).toBe(
      'Oi Tom &amp; &lt;Jerry&gt;',
    )
    expect(applyVariables('Oi {{ nome }}', values, 'text')).toBe(
      'Oi Tom & <Jerry>',
    )
  })

  it('uses the fallback for empty or unknown variables', () => {
    expect(applyVariables('Oi {{nome|cliente}}', { nome: ' ' }, 'text')).toBe(
      'Oi cliente',
    )
    expect(applyVariables('{{desconhecida}}!', {}, 'text')).toBe('!')
    expect(applyVariables('{{empresa|P &amp; D}}', {}, 'text')).toBe('P & D')
  })

  it('extracts the variables used (deduped)', () => {
    expect(extractVariables('{{nome}} {{empresa|x}} {{nome}}')).toEqual([
      'nome',
      'empresa',
    ])
  })

  it('fixes a second "?" after substituting a link that has a query', () => {
    expect(
      fixHrefQuerySeparators('<a href="https://x.com/?a=1?nota=3#top">'),
    ).toBe('<a href="https://x.com/?a=1&nota=3#top">')
    expect(fixHrefQuerySeparators('<a href="https://x.com/a">')).toBe(
      '<a href="https://x.com/a">',
    )
    expect(fixTextQuerySeparators('veja https://x.com/?a=1?b=2 agora')).toBe(
      'veja https://x.com/?a=1&b=2 agora',
    )
    expect(fixTextQuerySeparators('https://x.com/a#b')).toBe(
      'https://x.com/a#b',
    )
  })

  it('escapes every html special char', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    )
  })

  it('lists the picker variables with the campaign link as a link variable', () => {
    const pickable = EMAIL_VARIABLES.filter((v) => v.pickable)
    expect(pickable.map((v) => v.key)).toContain('campaign_link')
    expect(pickable.map((v) => v.key)).not.toContain('unsubscribe_url')
    expect(EMAIL_VARIABLES.find((v) => v.key === 'campaign_link')?.link).toBe(
      true,
    )
  })
})

describe('crm-email-builder rich text', () => {
  it('keeps the inline allowlist and drops everything else', () => {
    const dirty =
      '<p class="x" onclick="evil()">Oi <strong>forte</strong> <em>it</em> <u>s</u> <s>r</s> <b>b</b> <i>i</i><br/>linha</p>' +
      '<ul><li>um</li></ul><ol><li>dois</li></ol>' +
      '<script>alert(1)</script><style>p{}</style><h1>Título</h1><img src="x">' +
      '<!-- comentário --><![CDATA[x]]><!DOCTYPE html>'
    expect(sanitizeRichText(dirty)).toBe(
      '<p>Oi <strong>forte</strong> <em>it</em> <u>s</u> <s>r</s> <b>b</b> <i>i</i><br>linha</p>' +
        '<ul><li>um</li></ul><ol><li>dois</li></ol>Título',
    )
  })

  it('keeps safe links (http, mailto, tel, variables) and strips unsafe ones', () => {
    expect(sanitizeRichText('<a href="https://a.com/?x=1&amp;y=2">a</a>')).toBe(
      '<a href="https://a.com/?x=1&amp;y=2">a</a>',
    )
    expect(sanitizeRichText("<a href='mailto:a@b.com'>m</a>")).toBe(
      '<a href="mailto:a@b.com">m</a>',
    )
    expect(sanitizeRichText('<a href=tel:+5511>t</a>')).toBe(
      '<a href="tel:+5511">t</a>',
    )
    expect(sanitizeRichText('<a href="{{campaign_link}}">c</a>')).toBe(
      '<a href="{{campaign_link}}">c</a>',
    )
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a>x</a>',
    )
    expect(sanitizeRichText('<a title="x">sem href</a>')).toBe(
      '<a>sem href</a>',
    )
  })

  it('drops unclosed dangerous tags and stray closing void tags', () => {
    expect(sanitizeRichText('a<script src="x">b</br>')).toBe('ab')
  })

  it('turns plain text into paragraphs and line breaks', () => {
    expect(normalizeRichText('Linha 1\nLinha <2>\n\nOutro')).toBe(
      '<p>Linha 1<br>Linha &lt;2&gt;</p><p>Outro</p>',
    )
    expect(normalizeRichText('   ')).toBe('')
  })

  it('inlines e-mail styles and centers when asked', () => {
    const html = styleRichText(
      '<p>Oi <a href="https://a.com">a</a> <a>b</a></p><ul><li>x</li></ul>',
      {
        color: '#111111',
        linkColor: '#222222',
        fontSize: 16,
        lineHeight: 24,
        align: 'center',
      },
    )
    expect(html).toContain(
      '<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#111111;text-align:center">',
    )
    expect(html).toContain(
      '<a href="https://a.com" style="color:#222222;text-decoration:underline">',
    )
    expect(html).toContain('<a style="color:#222222')
    expect(html).toContain('<ul style="margin:0 0 16px;padding-left:24px;')
    expect(html).toContain('<li style="margin:0 0 4px">')
  })

  it('extracts readable plain text', () => {
    expect(
      richTextToPlain(
        '<p>Oi &amp; tchau &lt;3 &quot;x&quot; &#39;y&#39;</p><ul><li>a</li><li>b</li></ul>',
      ),
    ).toBe(`Oi & tchau <3 "x" 'y'\na\nb`)
    expect(richTextToPlain('<p>a</p>\n\n\n\n<p>b</p>')).toBe('a\n\nb')
  })
})

describe('crm-email-builder brand', () => {
  it('falls back to the workspace name, logo and default color', () => {
    expect(
      resolveEmailBrand(null, { name: 'Acme', logoUrl: 'https://l.png' }),
    ).toEqual({
      companyName: 'Acme',
      logoUrl: 'https://l.png',
      primaryColor: DEFAULT_PRIMARY_COLOR,
      address: '',
      website: '',
    })
    expect(resolveEmailBrand({}, { name: 'Acme', logoUrl: null }).logoUrl).toBe(
      '',
    )
  })

  it('prefers the saved brand', () => {
    expect(
      resolveEmailBrand(
        { ...brand, companyName: ' ', logoUrl: '' },
        { name: 'WS', logoUrl: 'https://ws.png' },
      ),
    ).toEqual({ ...brand, companyName: 'WS', logoUrl: '' })
  })

  it('picks a readable text color and tints', () => {
    expect(readableTextOn('#FFE14D')).toBe('#14171E')
    expect(readableTextOn('#1D4ED8')).toBe('#FFFFFF')
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#FFFFFF')).toBeCloseTo(1)
    expect(tint('#2893CC', 0)).toBe('#ffffff')
    expect(tint('#2893CC', 1)).toBe('#2893cc')
  })
})

describe('crm-email-builder layouts', () => {
  it('ships the 8 gallery layouts, all valid against the schema', () => {
    expect(EMAIL_LAYOUT_LIST.map((l) => l.id)).toEqual([
      'newsletter',
      'promocao',
      'convite-evento',
      'boas-vindas',
      'follow-up-proposta',
      'pesquisa-nps',
      'anuncio-produto',
      'lembrete',
    ])
    for (const layout of EMAIL_LAYOUT_LIST) {
      const doc = createBuilderDocument(layout.id)
      expect(EmailBuilderDocumentSchema.safeParse(doc).success).toBe(true)
      expect(validateLayoutStructure(doc)).toBeNull()
      expect(doc.sections[0].type).toBe('header')
      expect(doc.sections.at(-1)?.type).toBe('footer')
      const footer = layout.sections.at(-1)
      expect(footer?.optional).toBe(false)
    }
  })

  it('points the main CTA of every layout to the campaign link', () => {
    for (const layout of EMAIL_LAYOUT_LIST) {
      const json = JSON.stringify(createBuilderDocument(layout.id))
      expect(json).toContain(CAMPAIGN_LINK)
    }
  })

  it('creates independent copies of the defaults', () => {
    const a = createBuilderDocument('newsletter')
    a.sections[1].hidden = true
    expect(createBuilderDocument('newsletter').sections[1].hidden).toBe(false)
  })

  it('has panel fields and a label for every section type', () => {
    for (const type of EMAIL_BUILDER_SECTION_TYPES) {
      expect(SECTION_TYPE_LABEL[type]).toBeTruthy()
      expect(Array.isArray(SECTION_FIELDS[type])).toBe(true)
    }
    const products = SECTION_FIELDS.products.find((f) => f.kind === 'items')
    const features = SECTION_FIELDS.features.find((f) => f.kind === 'items')
    expect(products?.kind === 'items' && products.createItem()).toMatchObject({
      url: CAMPAIGN_LINK,
    })
    expect(features?.kind === 'items' && features.createItem()).toMatchObject({
      title: 'Novo item',
    })
  })

  it('finds a layout section by id', () => {
    expect(getLayoutSection('newsletter', 'cta')?.label).toBe('Botão')
    expect(getLayoutSection('newsletter', 'nope')).toBeUndefined()
  })

  it('rejects added, removed, duplicated or retyped sections', () => {
    const doc = createBuilderDocument('newsletter')
    expect(
      validateLayoutStructure({ ...doc, sections: doc.sections.slice(1) }),
    ).toMatch(/adicionadas nem removidas/)
    expect(
      validateLayoutStructure({
        ...doc,
        sections: doc.sections.map((s, i) =>
          i === 2 ? { ...doc.sections[1] } : s,
        ),
      }),
    ).toMatch(/adicionadas nem removidas/)
    expect(
      validateLayoutStructure({
        ...doc,
        sections: doc.sections.map((s) =>
          s.id === 'intro' ? { ...s, id: 'other' } : s,
        ),
      }),
    ).toMatch(/adicionadas nem removidas/)
    expect(
      validateLayoutStructure(
        withSection(doc, 'cta', (s) => ({
          id: s.id,
          type: 'text',
          hidden: false,
          props: { heading: '', body: '' },
        })),
      ),
    ).toBe('A seção "Botão" não pode mudar de tipo')
  })

  it('rejects hiding a required section but accepts optional ones', () => {
    const doc = createBuilderDocument('newsletter')
    expect(
      validateLayoutStructure(
        withSection(doc, 'footer', (s) => ({ ...s, hidden: true })),
      ),
    ).toBe('A seção "Rodapé" não pode ser ocultada')
    expect(
      validateLayoutStructure(
        withSection(doc, 'intro', (s) => ({ ...s, hidden: true })),
      ),
    ).toBeNull()
  })

  it('moves movable sections and refuses locked positions', () => {
    const doc = createBuilderDocument('newsletter')
    expect(canMoveSection(doc, 'intro', -1)).toBe(true)
    const moved = moveSection(doc, 'intro', -1)
    expect(moved.sections.map((s) => s.id).slice(0, 3)).toEqual([
      'header',
      'intro',
      'hero',
    ])
    expect(validateLayoutStructure(moved)).toBeNull()

    expect(canMoveSection(doc, 'hero', -1)).toBe(false)
    expect(canMoveSection(doc, 'cta', 1)).toBe(false)
    expect(canMoveSection(doc, 'header', -1)).toBe(false)
    expect(canMoveSection(doc, 'nope', 1)).toBe(false)
    expect(moveSection(doc, 'footer', 1)).toBe(doc)

    // A locked section dragged out of its slot is rejected.
    const swapped = {
      ...doc,
      sections: [doc.sections[1], doc.sections[0], ...doc.sections.slice(2)],
    }
    expect(validateLayoutStructure(swapped)).toBe(
      'A seção "Destaque" não pode mudar de posição',
    )
  })

  it('refuses to move a section that is movable into a locked slot', () => {
    // follow-up: message/cta/signature are all locked.
    const doc = createBuilderDocument('follow-up-proposta')
    expect(canMoveSection(doc, 'cta', -1)).toBe(false)
    expect(EMAIL_LAYOUTS['follow-up-proposta'].sections[2].movable).toBe(false)
  })
})

describe('crm-email-builder render', () => {
  it('renders html + text with variables intact and the unsubscribe link', async () => {
    const rendered = await renderBuilderEmail(
      createBuilderDocument('newsletter'),
      brand,
      { subject: 'Oi {{primeiro_nome}}' },
    )
    expect(rendered.subject).toBe('Oi {{primeiro_nome}}')
    expect(rendered.html).toContain('{{unsubscribe_url}}')
    expect(rendered.html).toContain('href="{{campaign_link}}"')
    expect(rendered.html).toContain('lang="pt-BR"')
    expect(rendered.html).not.toContain('data-section-id')
    expect(rendered.text).toContain('Descadastrar')
    expect(rendered.text).toContain('acme.com.br')
  })

  it('marks sections and empty slots only in preview mode', async () => {
    const doc = createBuilderDocument('newsletter')
    const preview = await renderBuilderEmail(
      withSection(doc, 'image', (s) => ({ ...s, hidden: false })),
      brand,
      { subject: 's', preview: true },
    )
    expect(preview.html).toContain('data-section-id="hero"')
    expect(preview.html).toContain('Adicione uma imagem')
    expect(preview.html).toContain('Imagem de destaque (opcional)')
    const final = await renderBuilderEmail(
      withSection(doc, 'image', (s) => ({ ...s, hidden: false })),
      brand,
      { subject: 's' },
    )
    expect(final.html).not.toContain('Adicione uma imagem')
  })

  it('skips hidden sections', async () => {
    const doc = withSection(
      createBuilderDocument('newsletter'),
      'highlights',
      (s) => ({ ...s, hidden: true }),
    )
    const { html } = await renderBuilderEmail(doc, brand, { subject: 's' })
    expect(html).not.toContain('Destaques')
  })

  it('always adds the unsubscribe footer, even without a footer section', async () => {
    const doc = createBuilderDocument('newsletter')
    const { html } = await renderBuilderEmail(
      { ...doc, sections: doc.sections.filter((s) => s.type !== 'footer') },
      brand,
      { subject: 's' },
    )
    expect(html).toContain('{{unsubscribe_url}}')
  })

  it('renders images, logo, links, prices and optional texts when filled', async () => {
    let doc = createBuilderDocument('promocao')
    doc = withSection(doc, 'hero', (s) =>
      s.type === 'hero'
        ? { ...s, props: { ...s.props, imageSrc: 'https://img/hero.png' } }
        : s,
    )
    doc = withSection(doc, 'products', (s) =>
      s.type === 'products'
        ? {
            ...s,
            props: {
              ...s.props,
              items: [
                {
                  ...s.props.items[0],
                  imageSrc: 'https://img/p.png',
                },
              ],
            },
          }
        : s,
    )
    const { html } = await renderBuilderEmail(
      doc,
      { ...brand, logoUrl: 'https://img/logo.png', primaryColor: '#FFE14D' },
      { subject: 's' },
    )
    expect(html).toContain('https://img/hero.png')
    expect(html).toContain('https://img/p.png')
    expect(html).toContain('https://img/logo.png')
    expect(html).toContain('R$ 99,90')
    expect(html).toContain('line-through')
    // light primary → dark button text
    expect(html).toContain('color:#14171E')
  })

  it('renders the image section with link and caption, and empty states', async () => {
    let doc = createBuilderDocument('newsletter')
    doc = withSection(doc, 'image', (s) =>
      s.type === 'image'
        ? {
            ...s,
            hidden: false,
            props: {
              imageSrc: 'https://img/a.png',
              imageAlt: 'A',
              linkUrl: 'https://a.com',
              caption: 'Legenda',
            },
          }
        : s,
    )
    doc = withSection(doc, 'cta', (s) =>
      s.type === 'button' ? { ...s, props: { ...s.props, label: '' } } : s,
    )
    doc = withSection(doc, 'intro', (s) =>
      s.type === 'text' ? { ...s, props: { heading: '', body: '' } } : s,
    )
    const final = await renderBuilderEmail(doc, brand, { subject: 's' })
    expect(final.html).toContain('href="https://a.com"')
    expect(final.html).toContain('Legenda')
    expect(final.html).not.toContain('Ver todas as novidades')

    const preview = await renderBuilderEmail(doc, brand, {
      subject: 's',
      preview: true,
    })
    expect(preview.html).toContain('Defina o texto do botão')
    expect(preview.html).toContain('Escreva o texto desta seção')
  })

  it('renders event, quote, coupon, signature and nps blocks', async () => {
    const invite = await renderBuilderEmail(
      createBuilderDocument('convite-evento'),
      brand,
      { subject: 's' },
    )
    expect(invite.html).toContain('12 de novembro de 2026')
    expect(invite.html).toContain('Confirmar presença')

    const launch = await renderBuilderEmail(
      createBuilderDocument('anuncio-produto'),
      brand,
      { subject: 's' },
    )
    expect(launch.html).toContain('Ana Souza')

    const promo = await renderBuilderEmail(
      createBuilderDocument('promocao'),
      brand,
      { subject: 's' },
    )
    expect(promo.html).toContain('OFERTA30')

    const followUp = await renderBuilderEmail(
      createBuilderDocument('follow-up-proposta'),
      brand,
      { subject: 's' },
    )
    expect(followUp.html).toContain('Executivo de contas')

    const nps = await renderBuilderEmail(
      createBuilderDocument('pesquisa-nps'),
      brand,
      { subject: 's' },
    )
    expect(nps.html).toContain('href="{{campaign_link}}?nota=10"')
    expect(nps.text).toContain('Responda com uma nota de 0 a 10')
  })

  it('builds nps links that keep an existing query and hash', async () => {
    const doc = withSection(
      createBuilderDocument('pesquisa-nps'),
      'nps',
      (s) =>
        s.type === 'nps'
          ? { ...s, props: { ...s.props, url: 'https://a.com/r?x=1#f' } }
          : s,
    )
    const { html } = await renderBuilderEmail(doc, brand, { subject: 's' })
    expect(html).toContain('href="https://a.com/r?x=1&amp;nota=0#f"')
    const empty = withSection(doc, 'nps', (s) =>
      s.type === 'nps' ? { ...s, props: { ...s.props, url: '' } } : s,
    )
    const rendered = await renderBuilderEmail(empty, brand, { subject: 's' })
    expect(rendered.text).not.toContain('Responda com uma nota')
  })

  it('omits empty optional parts of blocks', async () => {
    let doc = createBuilderDocument('anuncio-produto')
    doc = withSection(doc, 'quote', (s) =>
      s.type === 'quote' ? { ...s, props: { ...s.props, author: '' } } : s,
    )
    doc = withSection(doc, 'hero', (s) =>
      s.type === 'hero'
        ? {
            ...s,
            props: {
              ...s.props,
              eyebrow: '',
              heading: '',
              buttonLabel: '',
              body: '',
            },
          }
        : s,
    )
    doc = withSection(doc, 'features', (s) =>
      s.type === 'features'
        ? {
            ...s,
            props: { heading: '', items: [{ title: 'Só título', text: '' }] },
          }
        : s,
    )
    const { html } = await renderBuilderEmail(
      doc,
      { ...brand, address: '', website: '' },
      { subject: 's' },
    )
    expect(html).toContain('Só título')
    expect(html).not.toContain('Ana Souza')
    expect(html).not.toContain('Lançamento')

    let promo = createBuilderDocument('promocao')
    promo = withSection(promo, 'coupon', (s) =>
      s.type === 'coupon'
        ? { ...s, props: { ...s.props, label: '', expiry: '' } }
        : s,
    )
    promo = withSection(promo, 'products', (s) =>
      s.type === 'products'
        ? {
            ...s,
            props: {
              heading: '',
              buttonLabel: '',
              items: [
                {
                  ...s.props.items[0],
                  description: '',
                  price: '',
                  oldPrice: '',
                },
              ],
            },
          }
        : s,
    )
    const promoHtml = (await renderBuilderEmail(promo, brand, { subject: 's' }))
      .html
    expect(promoHtml).not.toContain('Use o cupom')
    expect(promoHtml).not.toContain('Mais procurados')

    let reminder = createBuilderDocument('lembrete')
    reminder = withSection(reminder, 'event', (s) =>
      s.type === 'event'
        ? { ...s, props: { ...s.props, heading: '', time: '' } }
        : s,
    )
    reminder = withSection(reminder, 'message', (s) =>
      s.type === 'text' ? { ...s, props: { ...s.props, heading: '' } } : s,
    )
    const reminderHtml = (
      await renderBuilderEmail(reminder, brand, { subject: 's' })
    ).html
    expect(reminderHtml).not.toContain('Horário')

    let welcome = createBuilderDocument('boas-vindas')
    welcome = withSection(welcome, 'signature', (s) =>
      s.type === 'signature'
        ? { ...s, props: { closing: '', name: '', role: '', contact: '' } }
        : s,
    )
    const nps = withSection(
      createBuilderDocument('pesquisa-nps'),
      'nps',
      (s) =>
        s.type === 'nps' ? { ...s, props: { ...s.props, question: '' } } : s,
    )
    const footerless = withSection(welcome, 'footer', (s) =>
      s.type === 'footer' ? { ...s, props: { note: '' } } : s,
    )
    expect(
      (await renderBuilderEmail(footerless, brand, { subject: 's' })).html,
    ).not.toContain('Um abraço')
    expect(
      (await renderBuilderEmail(nps, brand, { subject: 's' })).html,
    ).not.toContain('quanto você recomendaria')
  })

  it('handles blank labels, missing links, captions, old prices and roles', async () => {
    let doc = createBuilderDocument('anuncio-produto')
    doc = { ...doc, previewText: '' }
    doc = withSection(doc, 'hero', (s) =>
      s.type === 'hero' ? { ...s, props: { ...s.props, buttonLabel: ' ' } } : s,
    )
    doc = withSection(doc, 'cta', (s) =>
      s.type === 'button' ? { ...s, props: { ...s.props, url: '' } } : s,
    )
    doc = withSection(doc, 'quote', (s) =>
      s.type === 'quote' ? { ...s, props: { ...s.props, role: '' } } : s,
    )
    const { html } = await renderBuilderEmail(doc, brand, { subject: 's' })
    expect(html).toContain('Ana Souza')
    expect(html).not.toContain('Conhecer agora')
    expect(html).toContain('Quero conhecer')

    let promo = createBuilderDocument('promocao')
    promo = withSection(promo, 'products', (s) =>
      s.type === 'products'
        ? {
            ...s,
            props: {
              ...s.props,
              items: [{ ...s.props.items[0], oldPrice: '' }],
            },
          }
        : s,
    )
    const promoHtml = (await renderBuilderEmail(promo, brand, { subject: 's' }))
      .html
    expect(promoHtml).not.toContain('line-through')

    const news = withSection(
      createBuilderDocument('newsletter'),
      'image',
      (s) =>
        s.type === 'image'
          ? {
              ...s,
              hidden: false,
              props: {
                imageSrc: 'https://img/b.png',
                imageAlt: 'B',
                linkUrl: '',
                caption: '',
              },
            }
          : s,
    )
    const newsHtml = (await renderBuilderEmail(news, brand, { subject: 's' }))
      .html
    expect(newsHtml).toContain('https://img/b.png')
  })

  it('personalizes subject, html and text', async () => {
    const rendered = await renderBuilderEmail(
      createBuilderDocument('follow-up-proposta'),
      brand,
      { subject: EMAIL_LAYOUTS['follow-up-proposta'].defaultSubject },
    )
    const values = contactToVariables(
      { email: 'a@b.com', name: 'João Lima', company: 'P&D Ltda' },
      {
        campaignLink: 'https://lp.com/?utm_source=email',
        unsubscribeUrl: 'https://u/t',
      },
    )
    const email = personalizeEmail(rendered, values)
    expect(email.subject).toBe('Sobre a proposta para a P&D Ltda')
    expect(email.html).toContain('P&amp;D Ltda')
    expect(email.html).toContain('href="https://u/t"')
    expect(email.html).toContain('href="https://lp.com/?utm_source=email"')
    expect(email.html).not.toContain('{{')
    expect(email.text).toContain('Olá, João?')
    expect(email.text).not.toContain('{{')
  })
})
