import { describe, expect, it } from 'vitest'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { isIssueBlocked, issueRelations, issueSubtaskProgress } from './issue-progress'
const issue: ItsaplanIssueSummary = {
  id: 1,
  sequenceNumber: 1,
  identifier: 'P-1',
  title: 'Task',
  columnId: 1,
  assigneeUserId: null,
  priority: null
}
const metadata: ItsaplanProjectDetails = {
  project: { id: 1, key: 'P', ref: 'p', name: 'P' },
  assignees: [],
  columns: [
    { id: 1, name: 'Working', stateType: 'started', color: '', position: 0 },
    { id: 2, name: 'Done', stateType: 'completed', color: '', position: 1 },
    { id: 3, name: 'Canceled', stateType: 'canceled', color: '', position: 2 }
  ]
}
describe('issue progress', () => {
  it('counts each child by its own terminal state and ignores a self cycle', () => {
    const children = [
      { ...issue, id: 2, parentId: 1, columnId: 2 },
      { ...issue, id: 3, parentId: 1, columnId: 3 },
      { ...issue, id: 4, parentId: 1 },
      { ...issue, parentId: 1 }
    ]
    expect(issueSubtaskProgress(issue, children, metadata)).toEqual({
      total: 3,
      completed: 1,
      canceled: 1
    })
  })
  it('blocks only for known active incoming links, not parent, outgoing, terminal or unknown states', () => {
    const target = { ...issue, id: 2, identifier: 'P-2' }
    const linked = (direction: string, columnId: number) => ({
      ...issue,
      parentId: 2,
      links: [{ id: 4, kind: 'blocks', direction, issue: { ...target, columnId } }]
    })
    expect(isIssueBlocked(linked('inward', 1), [], metadata)).toBe(true)
    expect(isIssueBlocked(linked('outward', 1), [], metadata)).toBe(false)
    expect(isIssueBlocked(linked('inward', 2), [], metadata)).toBe(false)
    expect(isIssueBlocked(linked('inward', 99), [], metadata)).toBe(false)
    expect(isIssueBlocked({ ...issue, parentId: 2 }, [target], metadata)).toBe(false)
    const legacy = { ...issue, links: [{ issueId: 2, relation: 'blocked_by' }] }
    expect(isIssueBlocked(legacy, [target], metadata)).toBe(true)
  })
  it('keeps distinct source and semantic relation keys stable across reordering', () => {
    const target = { ...issue, id: 2, identifier: 'P-2' }
    const links = [
      { id: 10, kind: 'blocks', direction: 'inward', issue: target },
      { id: 11, kind: 'blocks', direction: 'outward', issue: target },
      { issueId: 2, relation: 'blocked_by' },
      { issueId: 2, relation: 'related' },
      { issueId: 2, relation: 'related' }
    ]
    const issueWithLinks = { ...issue, links }
    const issueWithReversedLinks = { ...issue, links: links.toReversed() }
    const keys = issueRelations(issueWithLinks).map((relation) => relation.key)
    const reversed = issueRelations(issueWithReversedLinks).map((relation) => relation.key)
    expect(keys).toHaveLength(4)
    expect(new Set(keys).size).toBe(4)
    expect(new Set(reversed)).toEqual(new Set(keys))
  })
})
