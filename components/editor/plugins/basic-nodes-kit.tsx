'use client';

import { BasicBlocksKit } from '@/components/editor/plugins/basic-blocks-kit';
import { BasicMarksKit } from '@/components/editor/plugins/basic-marks-kit';

export const BasicNodesKit = [...BasicBlocksKit, ...BasicMarksKit];
