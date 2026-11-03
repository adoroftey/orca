import { EMPTY_ISSUES, stableKeys } from './view-guards'
import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { ItsaplanIssue } from '../../../../../../shared/itsaplan/types'
type Relation = { issueId: number; relation?: string; type?: string }
function isRelation(value: unknown): value is Relation {
  return (
    !!value &&
    typeof value === 'object' &&
    'issueId' in value &&
    typeof value.issueId === 'number' &&
    (!('relation' in value) || typeof value.relation === 'string') &&
    (!('type' in value) || typeof value.type === 'string')
  )
}
function hasLinks(issue: ItsaplanIssue): issue is ItsaplanIssue & { links: unknown[] } {
  return 'links' in issue && Array.isArray(issue.links)
}
export function IssueRelations({
  issue,
  allIssues = EMPTY_ISSUES,
  display,
  onOpenIssue
}: {
  issue: ItsaplanIssue
  allIssues?: ItsaplanIssue[]
  display: Record<string, unknown>
  onOpenIssue: (id: number) => void
}) {
  const [collapsed, setCollapsed] = useState(display.collapseSubtasks === true)
  const children = allIssues.filter((item) => item.parentId === issue.id)
  return (
    <>
      {display.showSubtasks !== false && children.length > 0 && (
        <div>
          <button aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '+' : '−'} {translate('itsaplan.planning.views.subtasks', 'Subtasks')}
          </button>
          {!collapsed &&
            children.map((child) => (
              <button
                className="block pl-3 hover:underline"
                key={child.id}
                onClick={() => onOpenIssue(child.id)}
              >
                {child.identifier} {child.title}
              </button>
            ))}
        </div>
      )}
      {display.showLinks === true &&
        hasLinks(issue) &&
        issue.links.filter(isRelation).map((link) => {
          const target = allIssues.find((item) => item.id === link.issueId)
          return (
            <button
              className="block hover:underline"
              key={stableKeys([link])[0]}
              onClick={() => onOpenIssue(link.issueId)}
            >
              {link.relation ?? link.type ?? ''}{' '}
              {target ? `${target.identifier} ${target.title}` : link.issueId}
            </button>
          )
        })}
    </>
  )
}
