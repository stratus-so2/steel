import {
  Building01Icon,
  CheckListIcon,
  Coins01Icon,
  FileCheckIcon,
  HandshakeIcon,
  IdeaIcon,
  Image01Icon,
  SignatureIcon,
  Target01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ComponentType } from 'react'
import type {
  CrmProposalSectionContent,
  CrmProposalSectionType,
} from '@/src/schemas/crm-proposal.schema'
import {
  ClientNeedsDisplay,
  ClientNeedsEditor,
  clientNeedsDefaultContent,
} from './client-needs-section'
import {
  CommercialTermsDisplay,
  CommercialTermsEditor,
  commercialTermsDefaultContent,
} from './commercial-terms-section'
import {
  CompanyPresentationDisplay,
  CompanyPresentationEditor,
  companyPresentationDefaultContent,
} from './company-presentation-section'
import { CoverDisplay, CoverEditor, coverDefaultContent } from './cover-section'
import {
  ProductsPricingDisplay,
  ProductsPricingEditor,
  productsPricingDefaultContent,
} from './products-pricing-section'
import { ScopeDisplay, ScopeEditor, scopeDefaultContent } from './scope-section'
import {
  SignatureDisplay,
  SignatureEditor,
  signatureDefaultContent,
} from './signature-section'
import {
  SolutionDisplay,
  SolutionEditor,
  solutionDefaultContent,
} from './solution-section'
import {
  TermsConditionsDisplay,
  TermsConditionsEditor,
  termsConditionsDefaultContent,
} from './terms-conditions-section'

type IconType = typeof Image01Icon

export type SectionDefaultContentCtx = {
  proposalName?: string
  responsibleName?: string
}

export type SectionEditorProps = {
  content: CrmProposalSectionContent
  onChange: (content: CrmProposalSectionContent) => void
  workspaceId: string
}

export type SectionDisplayProps = {
  content: CrmProposalSectionContent
}

export type SectionDefinition = {
  type: CrmProposalSectionType
  label: string
  icon: IconType
  Editor: ComponentType<SectionEditorProps>
  Display: ComponentType<SectionDisplayProps>
  createDefaultContent: (
    ctx: SectionDefaultContentCtx,
  ) => CrmProposalSectionContent
}

type AnyEditor = ComponentType<any>
type AnyDisplay = ComponentType<any>

function def(
  type: CrmProposalSectionType,
  label: string,
  icon: IconType,
  Editor: AnyEditor,
  Display: AnyDisplay,
  createDefaultContent: (
    ctx: SectionDefaultContentCtx,
  ) => CrmProposalSectionContent,
): SectionDefinition {
  return { type, label, icon, Editor, Display, createDefaultContent }
}

export const SECTION_ORDER: CrmProposalSectionType[] = [
  'COVER',
  'COMPANY_PRESENTATION',
  'CLIENT_NEEDS',
  'SOLUTION',
  'SCOPE',
  'PRODUCTS_PRICING',
  'COMMERCIAL_TERMS',
  'TERMS_CONDITIONS',
  'SIGNATURE',
]

export const SECTION_REGISTRY: Record<
  CrmProposalSectionType,
  SectionDefinition
> = {
  COVER: def(
    'COVER',
    'Capa',
    Image01Icon,
    CoverEditor,
    CoverDisplay,
    coverDefaultContent,
  ),
  COMPANY_PRESENTATION: def(
    'COMPANY_PRESENTATION',
    'Apresentação da empresa',
    Building01Icon,
    CompanyPresentationEditor,
    CompanyPresentationDisplay,
    companyPresentationDefaultContent,
  ),
  CLIENT_NEEDS: def(
    'CLIENT_NEEDS',
    'Necessidade do cliente',
    Target01Icon,
    ClientNeedsEditor,
    ClientNeedsDisplay,
    clientNeedsDefaultContent,
  ),
  SOLUTION: def(
    'SOLUTION',
    'Solução da proposta',
    IdeaIcon,
    SolutionEditor,
    SolutionDisplay,
    solutionDefaultContent,
  ),
  SCOPE: def(
    'SCOPE',
    'Escopo dos serviços',
    CheckListIcon,
    ScopeEditor,
    ScopeDisplay,
    scopeDefaultContent,
  ),
  PRODUCTS_PRICING: def(
    'PRODUCTS_PRICING',
    'Produtos e valores',
    Coins01Icon,
    ProductsPricingEditor,
    ProductsPricingDisplay,
    productsPricingDefaultContent,
  ),
  COMMERCIAL_TERMS: def(
    'COMMERCIAL_TERMS',
    'Condições comerciais',
    HandshakeIcon,
    CommercialTermsEditor,
    CommercialTermsDisplay,
    commercialTermsDefaultContent,
  ),
  TERMS_CONDITIONS: def(
    'TERMS_CONDITIONS',
    'Termos e condições',
    FileCheckIcon,
    TermsConditionsEditor,
    TermsConditionsDisplay,
    termsConditionsDefaultContent,
  ),
  SIGNATURE: def(
    'SIGNATURE',
    'Assinatura',
    SignatureIcon,
    SignatureEditor,
    SignatureDisplay,
    signatureDefaultContent,
  ),
}
