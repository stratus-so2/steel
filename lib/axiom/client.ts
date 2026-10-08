'use client';
import axiomClient from '@/lib/axiom/axiom';
import { buildLogTransports } from '@/lib/axiom/transports';
import { NEXT_PUBLIC_AXIOM_DATASET, NEXT_PUBLIC_AXIOM_TOKEN } from '@/lib/env/env';
import { Logger } from '@axiomhq/logging';
import { createUseLogger, createWebVitalsComponent } from '@axiomhq/react';
import { nextJsFormatters } from '@axiomhq/nextjs/client';

export const logger = new Logger({
  // No token/dataset (local runs) → console only, nothing reaches Axiom.
  transports: buildLogTransports({
    axiom: axiomClient,
    token: NEXT_PUBLIC_AXIOM_TOKEN,
    dataset: NEXT_PUBLIC_AXIOM_DATASET,
    console: false,
  }),
  formatters: nextJsFormatters,
});

const useLogger = createUseLogger(logger);
const WebVitals = createWebVitalsComponent(logger);

export { useLogger, WebVitals };
