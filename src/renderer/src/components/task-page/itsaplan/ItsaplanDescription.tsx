import { useState } from 'react'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { translate } from '@/i18n/i18n'

export function ItsaplanDescription({
  content,
  preview = false
}: {
  content: string
  preview?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  if (preview) {
    return (
      <CommentMarkdown
        content={content}
        inert
        aria-hidden="true"
        variant="compact"
        renderMermaid={false}
        className="max-h-10 overflow-hidden text-sm text-muted-foreground [&_img]:hidden [&_pre]:hidden [&_table]:hidden"
      />
    )
  }
  return (
    <div className="min-w-0">
      <CommentMarkdown
        content={content}
        inert={!expanded}
        aria-hidden={expanded ? undefined : true}
        variant="compact"
        renderMermaid={false}
        className={expanded ? '' : 'max-h-64 overflow-hidden'}
      />
      <button
        type="button"
        className="mt-1 text-xs text-muted-foreground hover:underline"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? translate('itsaplan.presentation.collapseDescription', 'Collapse description')
          : translate('itsaplan.presentation.showFullDescription', 'Show full description')}
      </button>
    </div>
  )
}
