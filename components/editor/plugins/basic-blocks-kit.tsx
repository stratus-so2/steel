'use client';

import {
  BlockquoteRules,
  HeadingRules,
  HorizontalRuleRules,
} from '@platejs/basic-nodes';
import {
  BlockquotePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  H6Plugin,
  HorizontalRulePlugin,
} from '@platejs/basic-nodes/react';
import { ParagraphPlugin } from 'platejs/react';

import { BlockquoteElement } from '@/components/editor/ui/blockquote-node';
import {
  H1Element,
  H2Element,
  H3Element,
  H4Element,
  H5Element,
  H6Element,
} from '@/components/editor/ui/heading-node';
import { HrElement } from '@/components/editor/ui/hr-node';
import { ParagraphElement } from '@/components/editor/ui/paragraph-node';

/**
 * ⌘⌥1…6 on macOS; Ctrl+Shift+1…6 on Windows/Linux, where Ctrl+Alt is AltGr
 * on ABNT2 keyboards (AltGr+1…6 types ¹²³£¢¬). Both are bound everywhere:
 * the other platform's combo is harmless.
 */
export function headingKeys(level: number): string[] {
  return [`meta+alt+${level}`, `ctrl+shift+${level}`]
}

export const BasicBlocksKit = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    node: {
      component: H1Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: headingKeys(1) } },
  }),
  H2Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    node: {
      component: H2Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: headingKeys(2) } },
  }),
  H3Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    node: {
      component: H3Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: headingKeys(3) } },
  }),
  H4Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    node: {
      component: H4Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: headingKeys(4) } },
  }),
  H5Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    node: {
      component: H5Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: headingKeys(5) } },
  }),
  H6Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    node: {
      component: H6Element,
    },
    rules: {
      break: { empty: 'reset' },
    },
    shortcuts: { toggle: { keys: headingKeys(6) } },
  }),
  BlockquotePlugin.configure({
    inputRules: [BlockquoteRules.markdown()],
    node: { component: BlockquoteElement },
    shortcuts: { toggle: { keys: 'mod+shift+period' } },
  }),
  HorizontalRulePlugin.configure({
    inputRules: [
      HorizontalRuleRules.markdown({ variant: '-' }),
      HorizontalRuleRules.markdown({ variant: '_' }),
    ],
    node: {
      component: HrElement,
    },
  }),
];
