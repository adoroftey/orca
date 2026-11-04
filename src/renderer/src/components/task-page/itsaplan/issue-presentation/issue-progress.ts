import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'

type Relation = {
  key: string
  id: number
  label: string
  target?: ItsaplanIssueSummary
  blocksIncoming: boolean
}
export function issueRelations(issue: ItsaplanIssueSummary): Relation[] {
  if (!('links' in issue) || !Array.isArray(issue.links)) {
    return []
  }
  const relations = issue.links.flatMap((link: unknown): Relation[] => {
    if (!link || typeof link !== 'object') {
      return []
    }
    if ('issueId' in link && typeof link.issueId === 'number') {
      const label =
        'relation' in link && typeof link.relation === 'string'
          ? link.relation
          : 'type' in link && typeof link.type === 'string'
            ? link.type
            : ''
      const key =
        'id' in link && (typeof link.id === 'number' || typeof link.id === 'string')
          ? JSON.stringify(['id', link.id])
          : JSON.stringify(['legacy', link.issueId, label])
      return [{ key, id: link.issueId, label, blocksIncoming: label === 'blocked_by' }]
    }
    if (
      !('kind' in link) ||
      !('direction' in link) ||
      !('issue' in link) ||
      !link.issue ||
      typeof link.issue !== 'object'
    ) {
      return []
    }
    const target = link.issue
    if (
      !('id' in target) ||
      typeof target.id !== 'number' ||
      !('columnId' in target) ||
      typeof target.columnId !== 'number' ||
      !('identifier' in target) ||
      typeof target.identifier !== 'string' ||
      !('title' in target) ||
      typeof target.title !== 'string' ||
      !('sequenceNumber' in target) ||
      typeof target.sequenceNumber !== 'number'
    ) {
      return []
    }
    if (
      (link.direction !== 'inward' && link.direction !== 'outward') ||
      (link.kind !== 'blocks' && link.kind !== 'relates' && link.kind !== 'duplicates')
    ) {
      return []
    }
    const label =
      link.kind === 'blocks'
        ? link.direction === 'inward'
          ? 'Blocked by'
          : 'Blocks'
        : link.kind === 'relates'
          ? 'Related'
          : 'Duplicates'
    return [
      {
        key:
          'id' in link && (typeof link.id === 'number' || typeof link.id === 'string')
            ? JSON.stringify(['id', link.id])
            : JSON.stringify(['relation', target.id, link.kind, link.direction]),
        id: target.id,
        label,
        blocksIncoming: link.kind === 'blocks' && link.direction === 'inward',
        target: {
          id: target.id,
          columnId: target.columnId,
          identifier: target.identifier,
          title: target.title,
          sequenceNumber: target.sequenceNumber,
          assigneeUserId: null,
          priority: null
        }
      }
    ]
  })
  return [...new Map(relations.map((relation) => [relation.key, relation])).values()]
}
export function issueSubtaskProgress(
  issue: ItsaplanIssueSummary,
  allIssues: ItsaplanIssueSummary[] = [],
  metadata: ItsaplanProjectDetails | null = null
) {
  const children = allIssues.filter((item) => item.id !== issue.id && item.parentId === issue.id)
  const state = (item: ItsaplanIssueSummary) =>
    metadata?.columns.find((column) => column.id === item.columnId)?.stateType
  return {
    total: children.length,
    completed: children.filter((item) => state(item) === 'completed').length,
    canceled: children.filter((item) => state(item) === 'canceled').length
  }
}
export function isIssueBlocked(
  issue: ItsaplanIssueSummary,
  allIssues: ItsaplanIssueSummary[] = [],
  metadata: ItsaplanProjectDetails | null = null
): boolean {
  return issueRelations(issue).some((link) => {
    if (!link.blocksIncoming || link.id === issue.id) {
      return false
    }
    const target = allIssues.find((item) => item.id === link.id) ?? link.target
    const state = metadata?.columns.find((column) => column.id === target?.columnId)?.stateType
    return state === 'unstarted' || state === 'started' || state === 'backlog'
  })
}
