import { translate } from '@/i18n/i18n'
import { IssueStatusBoard } from './issue-presentation/IssueStatusBoard'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../shared/itsaplan/types'

export function ItsaplanIssueList({
  issues,
  metadata,
  allIssues,
  totalCount,
  expandMatches,
  searchCapped,
  onSelect
}: {
  issues: ItsaplanIssueSummary[]
  metadata: ItsaplanProjectDetails | null
  allIssues?: ItsaplanIssueSummary[]
  totalCount?: number
  expandMatches?: boolean
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
        <IssueStatusBoard
          issues={issues}
          metadata={metadata}
          allIssues={allIssues}
          totalCount={totalCount}
          expandMatches={expandMatches}
          onOpenIssue={onSelect}
          filterable
        />
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          {translate('itsaplan.issues.empty', 'No issues match these filters.')}
        </p>
      )}
    </>
  )
}
