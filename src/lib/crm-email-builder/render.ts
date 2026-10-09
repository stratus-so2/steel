import { render, toPlainText } from '@react-email/render'
import { createElement } from 'react'
import type { EmailBuilderDocument } from '@/src/schemas/crm-email-builder.schema'
import type { EmailBrand } from './brand'
import { BuilderEmail } from './email'
import { applyVariables, type EmailVariableValues } from './variables'

export type RenderedEmail = { subject: string; html: string; text: string }

/** html-to-text uppercases headings by default, which would turn
 * `{{primeiro_nome}}` into an unknown `{{PRIMEIRO_NOME}}`. */
const HEADING_SELECTORS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(
  (selector) => ({ selector, options: { uppercase: false } }),
)

/** Plain-text version of e-mail HTML (keeps variables intact). */
export function emailHtmlToText(html: string): string {
  return toPlainText(html, { selectors: HEADING_SELECTORS })
}

/**
 * Renders a builder document to e-mail HTML + plain text with
 * `@react-email/render`. Variables stay as `{{key}}` — personalize the
 * result per recipient with `personalizeEmail`. Isomorphic: the editor
 * preview and the server send path run the same code.
 */
export async function renderBuilderEmail(
  document: EmailBuilderDocument,
  brand: EmailBrand,
  options: { subject: string; preview?: boolean },
): Promise<RenderedEmail> {
  const element = createElement(BuilderEmail, {
    document,
    brand,
    subject: options.subject,
    preview: options.preview ?? false,
  })
  const html = await render(element)
  return { subject: options.subject, html, text: emailHtmlToText(html) }
}

/** Resolves the variables of an already-rendered e-mail for one contact. */
export function personalizeEmail(
  email: RenderedEmail,
  values: EmailVariableValues,
): RenderedEmail {
  return {
    subject: applyVariables(email.subject, values, 'text'),
    html: applyVariables(email.html, values, 'html'),
    text: applyVariables(email.text, values, 'text'),
  }
}
