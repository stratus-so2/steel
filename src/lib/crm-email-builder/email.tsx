import type { CSSProperties, ReactNode } from 'react'
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'react-email'
import type {
  EmailBuilderDocument,
  EmailBuilderSection,
  EmailBuilderSectionOf,
} from '@/src/schemas/crm-email-builder.schema'
import { type EmailBrand, readableTextOn, tint } from './brand'
import { styleRichText } from './rich-text'
import { UNSUBSCRIBE_URL } from './variables'

/**
 * The visual-builder e-mail, written with React Email components and inline
 * styles only (no Tailwind) so the very same tree renders in the browser
 * preview and on the server at send time. Tokens follow the react-email
 * "Barebone" template (MIT): neutral card on a light gray canvas.
 */

export const EMAIL_WIDTH = 600

const color = {
  canvas: '#F3F4F6',
  card: '#FFFFFF',
  fg: '#14171E',
  fg2: '#43454B',
  fg3: '#7B7D81',
  stroke: '#E4E4E7',
}

const font =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

type Ctx = {
  brand: EmailBrand
  /** Editor preview: sections become clickable and empty slots show hints. */
  preview: boolean
}

const PAD_X = 40

function Block({
  section,
  ctx,
  style,
  children,
}: {
  section: EmailBuilderSection
  ctx: Ctx
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <Section
      data-section-id={ctx.preview ? section.id : undefined}
      style={{ padding: `16px ${PAD_X}px`, ...style }}
    >
      {children}
    </Section>
  )
}

function Placeholder({ ctx, label }: { ctx: Ctx; label: string }) {
  if (!ctx.preview) return null
  return (
    <Section
      style={{
        border: `1px dashed ${color.stroke}`,
        borderRadius: 8,
        backgroundColor: '#FAFAFA',
        textAlign: 'center',
        padding: '28px 16px',
        margin: '0 0 16px',
      }}
    >
      <Text style={{ margin: 0, fontSize: 13, color: color.fg3 }}>{label}</Text>
    </Section>
  )
}

function PrimaryButton({
  label,
  href,
  ctx,
}: {
  label: string
  href: string
  ctx: Ctx
}) {
  if (!label.trim()) return null
  const bg = ctx.brand.primaryColor
  return (
    <Button
      href={href || undefined}
      style={{
        backgroundColor: bg,
        color: readableTextOn(bg),
        borderRadius: 8,
        padding: '12px 24px',
        fontSize: 15,
        fontWeight: 600,
        textDecoration: 'none',
        display: 'inline-block',
      }}
    >
      {label}
    </Button>
  )
}

function RichText({
  html,
  ctx,
  align,
}: {
  html: string
  ctx: Ctx
  align?: 'left' | 'center'
}) {
  if (!html.trim()) return null
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: styleRichText(html, {
          color: color.fg2,
          linkColor: ctx.brand.primaryColor,
          fontSize: 16,
          lineHeight: 26,
          align,
        }),
      }}
    />
  )
}

const h1: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 28,
  lineHeight: '36px',
  fontWeight: 700,
  color: color.fg,
}
const h2: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 20,
  lineHeight: '28px',
  fontWeight: 700,
  color: color.fg,
}
const small: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 13,
  lineHeight: '20px',
  color: color.fg3,
}

function HeaderBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'header'>
  ctx: Ctx
}) {
  const { brand } = ctx
  return (
    <Block
      section={section}
      ctx={ctx}
      style={{ padding: `32px ${PAD_X}px 8px` }}
    >
      {brand.logoUrl ? (
        <Img
          src={brand.logoUrl}
          alt={brand.companyName}
          height={36}
          style={{ height: 36, width: 'auto', border: 0 }}
        />
      ) : (
        <Text
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: brand.primaryColor,
          }}
        >
          {brand.companyName}
        </Text>
      )}
    </Block>
  )
}

function HeroBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'hero'>
  ctx: Ctx
}) {
  const p = section.props
  return (
    <Block section={section} ctx={ctx}>
      {p.imageSrc ? (
        <Img
          src={p.imageSrc}
          alt={p.imageAlt}
          width={EMAIL_WIDTH - PAD_X * 2}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: 12,
            margin: '0 0 24px',
          }}
        />
      ) : (
        <Placeholder ctx={ctx} label='Imagem de destaque (opcional)' />
      )}
      {p.eyebrow ? (
        <Text
          style={{
            margin: '0 0 8px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: ctx.brand.primaryColor,
          }}
        >
          {p.eyebrow}
        </Text>
      ) : null}
      {p.heading ? (
        <Heading as='h1' style={h1}>
          {p.heading}
        </Heading>
      ) : null}
      <RichText html={p.body} ctx={ctx} />
      {p.buttonLabel ? (
        <Section style={{ padding: '8px 0 0' }}>
          <PrimaryButton label={p.buttonLabel} href={p.buttonUrl} ctx={ctx} />
        </Section>
      ) : null}
    </Block>
  )
}

function TextBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'text'>
  ctx: Ctx
}) {
  const p = section.props
  return (
    <Block section={section} ctx={ctx}>
      {p.heading ? (
        <Heading as='h2' style={h2}>
          {p.heading}
        </Heading>
      ) : null}
      {p.body.trim() ? (
        <RichText html={p.body} ctx={ctx} />
      ) : (
        <Placeholder ctx={ctx} label='Escreva o texto desta seção' />
      )}
    </Block>
  )
}

function ImageBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'image'>
  ctx: Ctx
}) {
  const p = section.props
  if (!p.imageSrc) {
    return ctx.preview ? (
      <Block section={section} ctx={ctx}>
        <Placeholder ctx={ctx} label='Adicione uma imagem' />
      </Block>
    ) : null
  }
  const img = (
    <Img
      src={p.imageSrc}
      alt={p.imageAlt}
      width={EMAIL_WIDTH - PAD_X * 2}
      style={{ width: '100%', height: 'auto', borderRadius: 12 }}
    />
  )
  return (
    <Block section={section} ctx={ctx}>
      {p.linkUrl ? <Link href={p.linkUrl}>{img}</Link> : img}
      {p.caption ? (
        <Text style={{ ...small, textAlign: 'center' }}>{p.caption}</Text>
      ) : null}
    </Block>
  )
}

function ButtonBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'button'>
  ctx: Ctx
}) {
  const p = section.props
  if (!p.label.trim() && !ctx.preview) return null
  return (
    <Block section={section} ctx={ctx} style={{ textAlign: 'center' }}>
      {p.label.trim() ? (
        <PrimaryButton label={p.label} href={p.url} ctx={ctx} />
      ) : (
        <Placeholder ctx={ctx} label='Defina o texto do botão' />
      )}
      {p.note ? <Text style={small}>{p.note}</Text> : null}
    </Block>
  )
}

function ProductsBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'products'>
  ctx: Ctx
}) {
  const p = section.props
  return (
    <Block section={section} ctx={ctx}>
      {p.heading ? (
        <Heading as='h2' style={h2}>
          {p.heading}
        </Heading>
      ) : null}
      {p.items.map((item, index) => (
        <Row
          key={index}
          style={{
            border: `1px solid ${color.stroke}`,
            borderRadius: 12,
            margin: '0 0 12px',
          }}
        >
          {item.imageSrc ? (
            <Column style={{ width: 112, padding: 12, verticalAlign: 'top' }}>
              <Img
                src={item.imageSrc}
                alt={item.imageAlt}
                width={96}
                style={{ width: 96, height: 'auto', borderRadius: 8 }}
              />
            </Column>
          ) : null}
          <Column style={{ padding: 16, verticalAlign: 'top' }}>
            <Text
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: color.fg,
              }}
            >
              {item.name}
            </Text>
            {item.description ? (
              <Text
                style={{
                  margin: '4px 0 0',
                  fontSize: 14,
                  lineHeight: '20px',
                  color: color.fg2,
                }}
              >
                {item.description}
              </Text>
            ) : null}
            {item.price ? (
              <Text
                style={{
                  margin: '8px 0 0',
                  fontSize: 16,
                  fontWeight: 700,
                  color: color.fg,
                }}
              >
                {item.oldPrice ? (
                  <span
                    style={{
                      color: color.fg3,
                      fontWeight: 400,
                      textDecoration: 'line-through',
                      marginRight: 8,
                    }}
                  >
                    {item.oldPrice}
                  </span>
                ) : null}
                {item.price}
              </Text>
            ) : null}
            {item.url && p.buttonLabel ? (
              <Link
                href={item.url}
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: ctx.brand.primaryColor,
                }}
              >
                {p.buttonLabel} →
              </Link>
            ) : null}
          </Column>
        </Row>
      ))}
    </Block>
  )
}

function FeaturesBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'features'>
  ctx: Ctx
}) {
  const p = section.props
  const badge = ctx.brand.primaryColor
  return (
    <Block section={section} ctx={ctx}>
      {p.heading ? (
        <Heading as='h2' style={h2}>
          {p.heading}
        </Heading>
      ) : null}
      {p.items.map((item, index) => (
        <Row key={index} style={{ margin: '0 0 12px' }}>
          <Column style={{ width: 40, verticalAlign: 'top' }}>
            <Text
              style={{
                margin: 0,
                width: 28,
                height: 28,
                lineHeight: '28px',
                borderRadius: 14,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                backgroundColor: tint(badge, 0.12),
                color: badge,
              }}
            >
              {index + 1}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: color.fg,
              }}
            >
              {item.title}
            </Text>
            {item.text ? (
              <Text
                style={{
                  margin: '2px 0 0',
                  fontSize: 14,
                  lineHeight: '22px',
                  color: color.fg2,
                }}
              >
                {item.text}
              </Text>
            ) : null}
          </Column>
        </Row>
      ))}
    </Block>
  )
}

function EventBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'event'>
  ctx: Ctx
}) {
  const p = section.props
  const rows: [string, string][] = (
    [
      ['Data', p.date],
      ['Horário', p.time],
      ['Local', p.location],
    ] as [string, string][]
  ).filter(([, value]) => value.trim())
  return (
    <Block section={section} ctx={ctx}>
      <Section
        style={{
          backgroundColor: tint(ctx.brand.primaryColor, 0.06),
          borderRadius: 12,
          padding: '20px 24px',
        }}
      >
        {p.heading ? (
          <Heading as='h2' style={{ ...h2, fontSize: 18 }}>
            {p.heading}
          </Heading>
        ) : null}
        {rows.map(([label, value]) => (
          <Row key={label}>
            <Column style={{ width: 88, verticalAlign: 'top' }}>
              <Text style={{ margin: '4px 0', fontSize: 14, color: color.fg3 }}>
                {label}
              </Text>
            </Column>
            <Column style={{ verticalAlign: 'top' }}>
              <Text
                style={{
                  margin: '4px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  color: color.fg,
                }}
              >
                {value}
              </Text>
            </Column>
          </Row>
        ))}
        {p.buttonLabel ? (
          <Section style={{ padding: '12px 0 0' }}>
            <PrimaryButton label={p.buttonLabel} href={p.buttonUrl} ctx={ctx} />
          </Section>
        ) : null}
      </Section>
    </Block>
  )
}

function npsHref(url: string, score: number): string {
  if (!url) return ''
  const hash = url.indexOf('#')
  const base = hash === -1 ? url : url.slice(0, hash)
  const tail = hash === -1 ? '' : url.slice(hash)
  return `${base}${base.includes('?') ? '&' : '?'}nota=${score}${tail}`
}

function NpsBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'nps'>
  ctx: Ctx
}) {
  const p = section.props
  const scores = Array.from({ length: 11 }, (_, i) => i)
  return (
    <Block section={section} ctx={ctx}>
      {p.question ? (
        <Text
          style={{
            margin: '0 0 16px',
            fontSize: 17,
            fontWeight: 600,
            lineHeight: '26px',
            color: color.fg,
          }}
        >
          {p.question}
        </Text>
      ) : null}
      {p.url ? (
        // Plain-text readers get one link instead of eleven score links.
        <div
          style={{
            display: 'none',
            maxHeight: 0,
            overflow: 'hidden',
          }}
        >
          Responda com uma nota de 0 a 10: {p.url}
        </div>
      ) : null}
      <Row data-skip-in-text='true'>
        {scores.map((score) => (
          <Column key={score} style={{ padding: 2, textAlign: 'center' }}>
            <Link
              href={npsHref(p.url, score)}
              style={{
                display: 'block',
                padding: '8px 0',
                borderRadius: 6,
                border: `1px solid ${color.stroke}`,
                fontSize: 14,
                fontWeight: 600,
                color: ctx.brand.primaryColor,
                textDecoration: 'none',
              }}
            >
              {score}
            </Link>
          </Column>
        ))}
      </Row>
      <Row>
        <Column>
          <Text style={{ ...small, textAlign: 'left' }}>{p.lowLabel}</Text>
        </Column>
        <Column>
          <Text style={{ ...small, textAlign: 'right' }}>{p.highLabel}</Text>
        </Column>
      </Row>
    </Block>
  )
}

function QuoteBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'quote'>
  ctx: Ctx
}) {
  const p = section.props
  return (
    <Block section={section} ctx={ctx}>
      <Section
        style={{
          borderLeft: `4px solid ${ctx.brand.primaryColor}`,
          padding: '4px 0 4px 20px',
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: 18,
            lineHeight: '28px',
            fontStyle: 'italic',
            color: color.fg,
          }}
        >
          “{p.text}”
        </Text>
        {p.author ? (
          <Text style={{ ...small, margin: '12px 0 0' }}>
            <strong style={{ color: color.fg2 }}>{p.author}</strong>
            {p.role ? ` — ${p.role}` : ''}
          </Text>
        ) : null}
      </Section>
    </Block>
  )
}

function CouponBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'coupon'>
  ctx: Ctx
}) {
  const p = section.props
  return (
    <Block section={section} ctx={ctx}>
      <Section
        style={{
          border: `2px dashed ${ctx.brand.primaryColor}`,
          borderRadius: 12,
          padding: '20px 16px',
          textAlign: 'center',
        }}
      >
        {p.label ? (
          <Text style={{ margin: 0, fontSize: 14, color: color.fg2 }}>
            {p.label}
          </Text>
        ) : null}
        <Text
          style={{
            margin: '8px 0 0',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.12em',
            fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
            color: ctx.brand.primaryColor,
          }}
        >
          {p.code}
        </Text>
        {p.expiry ? <Text style={small}>{p.expiry}</Text> : null}
      </Section>
    </Block>
  )
}

function SignatureBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'signature'>
  ctx: Ctx
}) {
  const p = section.props
  const line: CSSProperties = {
    margin: 0,
    fontSize: 15,
    lineHeight: '22px',
    color: color.fg2,
  }
  return (
    <Block section={section} ctx={ctx}>
      {p.closing ? (
        <Text style={{ ...line, margin: '0 0 8px' }}>{p.closing}</Text>
      ) : null}
      {p.name ? (
        <Text style={{ ...line, fontWeight: 600, color: color.fg }}>
          {p.name}
        </Text>
      ) : null}
      {p.role ? <Text style={line}>{p.role}</Text> : null}
      {p.contact ? <Text style={line}>{p.contact}</Text> : null}
    </Block>
  )
}

function FooterBlock({
  section,
  ctx,
}: {
  section: EmailBuilderSectionOf<'footer'>
  ctx: Ctx
}) {
  const { brand } = ctx
  const footerText: CSSProperties = {
    margin: '0 0 6px',
    fontSize: 12,
    lineHeight: '18px',
    color: color.fg3,
    textAlign: 'center',
  }
  return (
    <Block
      section={section}
      ctx={ctx}
      style={{ padding: `8px ${PAD_X}px 32px` }}
    >
      <Hr style={{ borderColor: color.stroke, margin: '8px 0 20px' }} />
      {section.props.note ? (
        <Text style={footerText}>{section.props.note}</Text>
      ) : null}
      <Text style={{ ...footerText, fontWeight: 600, color: color.fg2 }}>
        {brand.companyName}
      </Text>
      {brand.address ? <Text style={footerText}>{brand.address}</Text> : null}
      {brand.website ? (
        <Text style={footerText}>
          <Link href={brand.website} style={{ color: color.fg3 }}>
            {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </Link>
        </Text>
      ) : null}
      <Text style={{ ...footerText, margin: '12px 0 0' }}>
        Você recebeu este e-mail porque está na base de contatos de{' '}
        {brand.companyName}. Não quer mais receber?{' '}
        <Link
          href={UNSUBSCRIBE_URL}
          data-unsubscribe='true'
          style={{ color: color.fg3, textDecoration: 'underline' }}
        >
          Descadastrar
        </Link>
        .
      </Text>
    </Block>
  )
}

export function EmailSection({
  section,
  ctx,
}: {
  section: EmailBuilderSection
  ctx: Ctx
}) {
  switch (section.type) {
    case 'header':
      return <HeaderBlock section={section} ctx={ctx} />
    case 'hero':
      return <HeroBlock section={section} ctx={ctx} />
    case 'text':
      return <TextBlock section={section} ctx={ctx} />
    case 'image':
      return <ImageBlock section={section} ctx={ctx} />
    case 'button':
      return <ButtonBlock section={section} ctx={ctx} />
    case 'products':
      return <ProductsBlock section={section} ctx={ctx} />
    case 'features':
      return <FeaturesBlock section={section} ctx={ctx} />
    case 'event':
      return <EventBlock section={section} ctx={ctx} />
    case 'nps':
      return <NpsBlock section={section} ctx={ctx} />
    case 'quote':
      return <QuoteBlock section={section} ctx={ctx} />
    case 'coupon':
      return <CouponBlock section={section} ctx={ctx} />
    case 'signature':
      return <SignatureBlock section={section} ctx={ctx} />
    case 'footer':
      return <FooterBlock section={section} ctx={ctx} />
  }
}

export function BuilderEmail({
  document,
  brand,
  subject,
  preview = false,
}: {
  document: EmailBuilderDocument
  brand: EmailBrand
  subject: string
  preview?: boolean
}) {
  const ctx: Ctx = { brand, preview }
  const visible = document.sections.filter((s) => !s.hidden)
  // The unsubscribe footer is mandatory (LGPD): even a malformed document
  // without a footer section still gets one.
  const hasFooter = visible.some((s) => s.type === 'footer')
  return (
    <Html lang='pt-BR'>
      <Head>
        <title>{subject}</title>
        <meta name='color-scheme' content='light' />
        <meta name='supported-color-schemes' content='light' />
      </Head>
      {document.previewText ? <Preview>{document.previewText}</Preview> : null}
      <Body
        style={{
          margin: 0,
          padding: '24px 0',
          backgroundColor: color.canvas,
          fontFamily: font,
        }}
      >
        <Container
          style={{
            maxWidth: EMAIL_WIDTH,
            width: '100%',
            backgroundColor: color.card,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {visible.map((section) => (
            <EmailSection key={section.id} section={section} ctx={ctx} />
          ))}
          {hasFooter ? null : (
            <FooterBlock
              section={{
                id: 'footer',
                type: 'footer',
                hidden: false,
                props: { note: '' },
              }}
              ctx={ctx}
            />
          )}
        </Container>
      </Body>
    </Html>
  )
}
