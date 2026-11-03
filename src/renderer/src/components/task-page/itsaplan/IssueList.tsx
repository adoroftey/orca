import { translate } from '@/i18n/i18n'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../shared/itsaplan/types'

export function ItsaplanIssueList({
  issues,
  metadata,
  searchCapped,
  onSelect
}: {
  issues: ItsaplanIssueSummary[]
  metadata: ItsaplanProjectDetails | null
  searchCapped: boolean
  onSelect: (id: number) => void
}) {
  return (
    <>
      {searchCapped ? (
        <p role="status" className="border-b border-border p-3 text-xs text-muted-foreground">
          {translate(
            'itsaplan.search.capped',
            'Showing up to 500 search matches. Refine your search to find other issues.'
          )}
        </p>
      ) : null}
      {issues.length ? (
        <ul className="divide-y divide-border">
          {issues.map((issue) => (
            <li key={issue.id}>
              <button
                className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-accent"
                type="button"
                onClick={() => onSelect(issue.id)}
                aria-label={`${issue.identifier} ${issue.title}`}
              >
                <span className="flex flex-wrap gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {issue.identifier}
                  </span>
                  <span>{issue.title}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {metadata?.columns.find((entry) => entry.id === issue.columnId)?.name} ·{' '}
                  {metadata?.assignees.find((entry) => entry.userId === issue.assigneeUserId)
                    ?.name ?? translate('itsaplan.assignee.none', 'Unassigned')}
                  {issue.archived ? ` · ${translate('itsaplan.issue.archived', 'Archived')}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          {translate('itsaplan.issues.empty', 'No issues match these filters.')}
        </p>
      )}
    </>
  )
}
