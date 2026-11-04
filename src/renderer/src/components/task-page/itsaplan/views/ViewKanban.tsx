import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { ItsaplanApi } from '../../../../../../shared/itsaplan/types'
import { IssueCard, ViewGroups, type LayoutProps } from './ViewIssueLayout'
export function ViewKanban(
  props: LayoutProps & { api: ItsaplanApi; canEdit: boolean; onUpdated: () => void }
) {
  const [error, setError] = useState(false)
  const status = (props.display.group ?? 'status') === 'status'
  return (
    <>
      {error && (
        <p role="alert">
          {translate('itsaplan.planning.views.moveError', 'Unable to move the issue.')}
        </p>
      )}
      <ViewGroups
        {...props}
        render={(issues, key) => (
          <div
            className="space-y-2"
            onDragOver={(e) => {
              if (status && props.canEdit) {
                e.preventDefault()
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              const id = Number(e.dataTransfer.getData('text/plain'))
              const columnId = Number(key)
              if (
                status &&
                props.canEdit &&
                id &&
                props.metadata.columns.some((c) => c.id === columnId)
              ) {
                void props.api
                  .updateIssue(id, { columnId })
                  .then(() => {
                    setError(false)
                    props.onUpdated()
                  })
                  .catch(() => setError(true))
              }
            }}
          >
            {issues.map((issue) => (
              <div
                key={issue.id}
                draggable={status && props.canEdit}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(issue.id))}
              >
                <IssueCard {...props} issue={issue} />
              </div>
            ))}
          </div>
        )}
      />
    </>
  )
}
