'use client'

import { DiscussionOverlay } from '@/components/editor/ui/discussion-overlay'
import { discussionPlugin } from '@/components/editor/plugins/discussion-plugin'

export const DiscussionKit = [
  discussionPlugin.configure({
    render: { afterEditable: DiscussionOverlay },
  }),
]

export { discussionPlugin }
