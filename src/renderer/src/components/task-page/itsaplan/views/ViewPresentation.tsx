import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import { IssueRelationships } from '../issue-presentation/IssueRelationships'
export function IssueRelations({
  issue,
  allIssues,
  display,
  onOpenIssue,
  metadata = null
}: {
  issue: ItsaplanIssue
  allIssues?: ItsaplanIssue[]
  display: Record<string, unknown>
  onOpenIssue: (id: number) => void
  metadata?: ItsaplanProjectDetails | null
}) {
  return (
    <IssueRelationships
      issue={issue}
      allIssues={allIssues}
      display={{ ...display, showLinks: display.showLinks === true }}
      onOpenIssue={onOpenIssue}
      metadata={metadata}
    />
  )
}
