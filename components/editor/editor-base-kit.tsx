import { BaseBasicBlocksKit } from '@/components/editor/plugins/basic-blocks-base-kit'
import { BaseBasicMarksKit } from '@/components/editor/plugins/basic-marks-base-kit'
import { BaseCodeBlockKit } from '@/components/editor/plugins/code-block-base-kit'
import { BaseListKit } from '@/components/editor/plugins/list-base-kit'
import { BaseColumnKit } from '@/components/editor/plugins/column-base-kit'
import { BaseToggleKit } from '@/components/editor/plugins/toggle-base-kit'
import { BaseTocKit } from '@/components/editor/plugins/toc-base-kit'
import { BaseFootnoteKit } from '@/components/editor/plugins/footnote-base-kit'

// Static kits (SlateElement, no React editing state) used to serialize
// the wiki outside the live editor — HTML/PDF/image export.
// Covers the block types that already have their own static rendering;
// newer blocks (table, media, link, date, equation, mention, emoji,
// mermaid, excalidraw) still fall back to Plate's default until they
// get their own *-base-kit.
export const BaseEditorKit = [
  ...BaseBasicBlocksKit,
  ...BaseBasicMarksKit,
  ...BaseCodeBlockKit,
  ...BaseListKit,
  ...BaseColumnKit,
  ...BaseToggleKit,
  ...BaseTocKit,
  ...BaseFootnoteKit,
]
