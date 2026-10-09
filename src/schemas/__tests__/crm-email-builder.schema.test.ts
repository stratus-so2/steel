import { describe, expect, it } from 'vitest'
import { createBuilderDocument } from '@/src/lib/crm-email-builder/layouts'
import {
  CrmEmailBrandSchema,
  EmailBuilderDocumentSchema,
  isEmailBuilderImage,
  isEmailBuilderLink,
  RenderCrmEmailTemplateSchema,
} from '../crm-email-builder.schema'
import {
  CreateCrmEmailCampaignSchema,
  UpdateCrmEmailCampaignSchema,
} from '../crm-email-campaign.schema'
import {
  CreateCrmEmailTemplateSchema,
  UpdateCrmEmailTemplateSchema,
} from '../crm-email-template.schema'

const brand = {
  companyName: 'Acme',
  logoUrl: '',
  primaryColor: '#2893CC',
  address: '',
  website: '',
}

describe('crm-email-builder schema', () => {
  it('accepts safe links and variables, rejects scripts', () => {
    expect(isEmailBuilderLink('')).toBe(true)
    expect(isEmailBuilderLink('https://a.com')).toBe(true)
    expect(isEmailBuilderLink('mailto:a@b.com')).toBe(true)
    expect(isEmailBuilderLink('tel:+5511')).toBe(true)
    expect(isEmailBuilderLink('{{campaign_link}}?x=1')).toBe(true)
    expect(isEmailBuilderLink('{{ campaign_link|https://x.com }}')).toBe(true)
    expect(isEmailBuilderLink('javascript:alert(1)')).toBe(false)
    expect(isEmailBuilderLink('/relative')).toBe(false)
  })

  it('accepts only absolute http(s) images', () => {
    expect(isEmailBuilderImage('')).toBe(true)
    expect(isEmailBuilderImage('https://cdn/x.png')).toBe(true)
    expect(isEmailBuilderImage('data:image/png;base64,x')).toBe(false)
  })

  it('validates a full document and rejects bad content', () => {
    const doc = createBuilderDocument('promocao')
    expect(EmailBuilderDocumentSchema.safeParse(doc).success).toBe(true)
    const badLink = {
      ...doc,
      sections: doc.sections.map((s) =>
        s.type === 'button'
          ? { ...s, props: { ...s.props, url: 'ftp://x' } }
          : s,
      ),
    }
    expect(EmailBuilderDocumentSchema.safeParse(badLink).success).toBe(false)
    const tooManyItems = {
      ...doc,
      sections: doc.sections.map((s) =>
        s.type === 'products'
          ? {
              ...s,
              props: {
                ...s.props,
                items: Array.from({ length: 7 }, () => s.props.items[0]),
              },
            }
          : s,
      ),
    }
    expect(EmailBuilderDocumentSchema.safeParse(tooManyItems).success).toBe(
      false,
    )
    expect(
      EmailBuilderDocumentSchema.safeParse({ ...doc, layout: 'other' }).success,
    ).toBe(false)
    expect(
      EmailBuilderDocumentSchema.safeParse({
        ...doc,
        sections: [{ ...doc.sections[0], id: 'Not Valid' }],
      }).success,
    ).toBe(false)
  })

  it('validates the brand color and website', () => {
    expect(CrmEmailBrandSchema.safeParse(brand).success).toBe(true)
    expect(
      CrmEmailBrandSchema.safeParse({ ...brand, website: 'https://a.com' })
        .success,
    ).toBe(true)
    expect(
      CrmEmailBrandSchema.safeParse({ ...brand, website: 'acme.com' }).success,
    ).toBe(false)
    expect(
      CrmEmailBrandSchema.safeParse({ ...brand, primaryColor: '#fff' }).success,
    ).toBe(false)
    expect(
      CrmEmailBrandSchema.safeParse({ ...brand, logoUrl: 'ftp://x' }).success,
    ).toBe(false)
  })

  it('validates the render input', () => {
    expect(RenderCrmEmailTemplateSchema.safeParse({}).success).toBe(true)
    expect(
      RenderCrmEmailTemplateSchema.safeParse({
        personId: 'p1',
        sample: { email: 'a@b.com', name: 'Ana' },
        campaignLink: 'https://lp.com',
      }).success,
    ).toBe(true)
    expect(
      RenderCrmEmailTemplateSchema.safeParse({ campaignLink: 'x' }).success,
    ).toBe(false)
  })
})

describe('template and campaign schemas with the builder', () => {
  it('creates a template from a builder layout without HTML', () => {
    expect(
      CreateCrmEmailTemplateSchema.safeParse({
        name: 'N',
        subject: 'S',
        builderLayout: 'lembrete',
      }).success,
    ).toBe(true)
    expect(
      CreateCrmEmailTemplateSchema.safeParse({
        name: 'N',
        subject: 'S',
        builderLayout: 'nope',
      }).success,
    ).toBe(false)
    expect(
      CreateCrmEmailTemplateSchema.safeParse({ name: 'N', subject: 'S' })
        .success,
    ).toBe(false)
  })

  it('accepts a builder document on update', () => {
    expect(
      UpdateCrmEmailTemplateSchema.safeParse({
        builderDocument: createBuilderDocument('newsletter'),
      }).success,
    ).toBe(true)
  })

  it('creates a campaign from a template, or requires HTML otherwise', () => {
    const base = {
      subject: 'S',
      fromAddress: 'a@b.com',
      recipientScope: 'ALL' as const,
    }
    expect(
      CreateCrmEmailCampaignSchema.safeParse({
        ...base,
        templateId: 't1',
        campaignLink: 'https://lp.com/?utm_source=email',
      }).success,
    ).toBe(true)
    expect(CreateCrmEmailCampaignSchema.safeParse(base).success).toBe(false)
    expect(
      CreateCrmEmailCampaignSchema.safeParse({
        ...base,
        templateId: 't1',
        campaignLink: 'nope',
      }).success,
    ).toBe(false)
    expect(UpdateCrmEmailCampaignSchema.safeParse({}).success).toBe(true)
  })
})
