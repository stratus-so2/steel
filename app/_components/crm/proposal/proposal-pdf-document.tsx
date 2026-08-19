import {
  Document,
  Page,
  Image as PdfImage,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { CrmProposalSectionContent } from '@/src/schemas/crm-proposal.schema'
import type { CrmProposalSectionDTO } from '@/types/crm-proposal'

const currencyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', color: '#111' },
  section: { marginBottom: 24 },
  h1: { fontSize: 26, fontWeight: 700, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: 700, marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#555', marginBottom: 12 },
  paragraph: { lineHeight: 1.5, color: '#333' },
  coverPage: {
    padding: 48,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItem: { marginBottom: 10 },
  listItemTitle: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  listItemDescription: { color: '#555', lineHeight: 1.4 },
  image: { maxWidth: 220, maxHeight: 160, marginTop: 8, marginRight: 8 },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap' },
  table: { marginTop: 8 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableCellName: { flex: 3 },
  tableCellNum: { flex: 1, textAlign: 'right' },
  tableHeaderText: { fontSize: 9, fontWeight: 700, color: '#555' },
  totalRow: { marginTop: 10, alignItems: 'flex-end' },
  totalText: { fontSize: 14, fontWeight: 700 },
  signatureRow: { flexDirection: 'row', marginTop: 24 },
  signatureBox: { flex: 1, marginRight: 24 },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    height: 40,
    marginBottom: 6,
  },
})

function PdfSection({ content }: { content: CrmProposalSectionContent }) {
  switch (content.type) {
    case 'COVER':
      return (
        <Page size='A4' style={styles.coverPage}>
          {content.coverImageUrl ? (
            <PdfImage src={content.coverImageUrl} style={styles.image} />
          ) : null}
          <Text style={styles.h1}>{content.title}</Text>
          {content.subtitle ? (
            <Text style={styles.subtitle}>{content.subtitle}</Text>
          ) : null}
        </Page>
      )

    case 'COMPANY_PRESENTATION':
      return (
        <View style={styles.section}>
          <Text style={styles.h2}>
            {content.headline || 'Apresentação da empresa'}
          </Text>
          <Text style={styles.paragraph}>{content.description}</Text>
          {content.imageUrls.length > 0 ? (
            <View style={styles.imageRow}>
              {content.imageUrls.map((url) => (
                <PdfImage key={url} src={url} style={styles.image} />
              ))}
            </View>
          ) : null}
        </View>
      )

    case 'CLIENT_NEEDS':
      return (
        <View style={styles.section}>
          <Text style={styles.h2}>Necessidade do cliente</Text>
          {content.items.map((item) => (
            <View key={item.title} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.listItemDescription}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )

    case 'SOLUTION':
      return (
        <View style={styles.section}>
          <Text style={styles.h2}>Solução da proposta</Text>
          <Text style={styles.paragraph}>{content.description}</Text>
          {content.imageUrls.length > 0 ? (
            <View style={styles.imageRow}>
              {content.imageUrls.map((url) => (
                <PdfImage key={url} src={url} style={styles.image} />
              ))}
            </View>
          ) : null}
        </View>
      )

    case 'SCOPE':
      return (
        <View style={styles.section}>
          <Text style={styles.h2}>Escopo dos serviços</Text>
          {content.items.map((item) => (
            <View key={item.title} style={styles.listItem}>
              <Text style={styles.listItemTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.listItemDescription}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )

    case 'PRODUCTS_PRICING':
      return (
        <View style={styles.section}>
          <Text style={styles.h2}>Produtos e valores</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCellName, styles.tableHeaderText]}>
                Item
              </Text>
              <Text style={[styles.tableCellNum, styles.tableHeaderText]}>
                Qtd.
              </Text>
              <Text style={[styles.tableCellNum, styles.tableHeaderText]}>
                Valor unit.
              </Text>
              <Text style={[styles.tableCellNum, styles.tableHeaderText]}>
                Total
              </Text>
            </View>
            {content.items.map((item) => (
              <View key={item.name} style={styles.tableRow}>
                <Text style={styles.tableCellName}>{item.name}</Text>
                <Text style={styles.tableCellNum}>{item.quantity}</Text>
                <Text style={styles.tableCellNum}>
                  {currencyFmt.format(item.unitPrice)}
                </Text>
                <Text style={styles.tableCellNum}>
                  {currencyFmt.format(item.total)}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.totalRow}>
            {content.discount > 0 ? (
              <Text>Desconto: {currencyFmt.format(content.discount)}</Text>
            ) : null}
            <Text style={styles.totalText}>
              Total: {currencyFmt.format(content.total)}
            </Text>
          </View>
        </View>
      )

    case 'COMMERCIAL_TERMS':
      return (
        <View style={styles.section}>
          <Text style={styles.h2}>Condições comerciais</Text>
          <Text style={styles.listItemTitle}>Pagamento</Text>
          <Text style={styles.paragraph}>{content.paymentTerms}</Text>
          {content.deliveryTerms ? (
            <>
              <Text style={[styles.listItemTitle, { marginTop: 8 }]}>
                Entrega
              </Text>
              <Text style={styles.paragraph}>{content.deliveryTerms}</Text>
            </>
          ) : null}
          {content.notes ? (
            <>
              <Text style={[styles.listItemTitle, { marginTop: 8 }]}>
                Observações
              </Text>
              <Text style={styles.paragraph}>{content.notes}</Text>
            </>
          ) : null}
        </View>
      )

    case 'TERMS_CONDITIONS':
      return (
        <View style={styles.section}>
          <Text style={styles.h2}>Termos e condições</Text>
          <Text style={styles.paragraph}>{content.text}</Text>
        </View>
      )

    case 'SIGNATURE':
      return (
        <View style={styles.section}>
          <Text style={styles.h2}>Assinatura</Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBox}>
              {content.signatureImageUrl ? (
                <PdfImage
                  src={content.signatureImageUrl}
                  style={{ height: 40, marginBottom: 6 }}
                />
              ) : (
                <View style={styles.signatureLine} />
              )}
              <Text style={styles.listItemTitle}>
                {content.companySignerName}
              </Text>
              {content.companySignerRole ? (
                <Text style={styles.listItemDescription}>
                  {content.companySignerRole}
                </Text>
              ) : null}
            </View>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.listItemTitle}>
                {content.clientSignerName || 'Cliente'}
              </Text>
            </View>
          </View>
        </View>
      )

    default:
      return null
  }
}

export function ProposalPdfDocument({
  name,
  sections,
}: {
  name: string
  sections: CrmProposalSectionDTO[]
}) {
  const enabled = [...sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)

  const cover = enabled.find((s) => s.type === 'COVER')
  const rest = enabled.filter((s) => s.type !== 'COVER')

  return (
    <Document title={name}>
      {cover ? (
        <PdfSection content={cover.content} />
      ) : (
        <Page size='A4' style={styles.page} />
      )}
      {rest.length > 0 ? (
        <Page size='A4' style={styles.page}>
          {rest.map((section) => (
            <PdfSection key={section.id} content={section.content} />
          ))}
        </Page>
      ) : null}
    </Document>
  )
}
