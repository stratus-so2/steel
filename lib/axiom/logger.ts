import { Logger } from '@axiomhq/logging'
import axiomClient from '@/lib/axiom/axiom'
import { flattenNestedFields } from '@/lib/axiom/log-fields'
import { buildLogTransports } from '@/lib/axiom/transports'
import {
  NEXT_PUBLIC_AXIOM_DATASET,
  NEXT_PUBLIC_AXIOM_TOKEN,
  NODE_ENV,
} from '@/lib/env/env'

const transports = buildLogTransports({
  axiom: axiomClient,
  token: NEXT_PUBLIC_AXIOM_TOKEN,
  dataset: NEXT_PUBLIC_AXIOM_DATASET,
  console: NODE_ENV !== 'production',
})

// Nested objects under `fields` become one JSON string column each, so a
// stray object never spreads into dozens of columns (dataset limit: 257).
export const logger = new Logger({
  transports,
  formatters: [flattenNestedFields],
})
