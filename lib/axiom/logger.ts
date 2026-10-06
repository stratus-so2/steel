import {
  AxiomJSTransport,
  ConsoleTransport,
  Logger,
  type Transport,
} from '@axiomhq/logging'
import axiomClient from '@/lib/axiom/axiom'
import { flattenNestedFields } from '@/lib/axiom/log-fields'
import { NEXT_PUBLIC_AXIOM_DATASET, NODE_ENV } from '@/lib/env/env'

const transports: [Transport, ...Transport[]] = [
  new AxiomJSTransport({
    axiom: axiomClient,
    dataset: NEXT_PUBLIC_AXIOM_DATASET,
  }),
]

if (NODE_ENV !== 'production') {
  transports.push(new ConsoleTransport({ prettyPrint: true }))
}

// Nested objects under `fields` become one JSON string column each, so a
// stray object never spreads into dozens of columns (dataset limit: 257).
export const logger = new Logger({
  transports,
  formatters: [flattenNestedFields],
})
