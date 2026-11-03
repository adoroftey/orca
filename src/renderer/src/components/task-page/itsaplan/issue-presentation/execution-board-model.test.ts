import { expect, it } from 'vitest'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import {
  buildExecutionRows,
  executionStages,
  executionMatrixMinWidth,
  issueExecutionStageKey
} from './execution-board-model'
const metadata: ItsaplanProjectDetails = {
  project: { id: 1, key: 'P', ref: 'P', name: 'P' },
  assignees: [],
  columns: [
    { id: 1, name: 'Todo', stateType: 'unstarted', color: '', position: 0 },
    { id: 2, name: 'Done', stateType: 'completed', color: '', position: 1 },
    { id: 3, name: 'Canceled', stateType: 'canceled', color: '', position: 2 }
  ]
}
const issue = (id: number, columnId: number, parentId?: number): ItsaplanIssueSummary => ({
  id,
  sequenceNumber: id,
  identifier: `P-${id}`,
  title: `Issue ${id}`,
  columnId,
  parentId,
  assigneeUserId: null,
  priority: null
})
it('keeps filtered parent as context and computes all descendant progress', () => {
  const parent = issue(1, 1),
    child = issue(2, 2, 1),
    canceled = issue(3, 3, 1),
    nested = issue(4, 1, 2)
  const [row] = buildExecutionRows([child], [parent, child, canceled, nested], metadata)
  expect(row).toMatchObject({
    parent,
    parentInResults: false,
    issues: [child],
    totalChildren: 3,
    completedChildren: 1,
    canceledChildren: 1
  })
  expect(issueExecutionStageKey(child, metadata)).toBe('2')
})
it('preserves each match once across parent markers, unknown stages and cyclic data', () => {
  const parent = issue(1, 1),
    child = issue(2, 99, 1),
    a = issue(3, 1, 4),
    b = issue(4, 2, 3)
  const input = [parent, child, a, b]
  const rows = buildExecutionRows(input, input, metadata)
  expect(rows.flatMap((row) => row.issues.map((item) => item.id))).toEqual([1, 2, 3, 4])
  expect(rows[0].parentInResults).toBe(true)
  expect(executionStages(input, metadata).map(({ key, count }) => [key, count])).toEqual([
    ['1', 2],
    ['2', 1],
    ['3', 0],
    ['unknown', 1]
  ])
})
it('includes both outer borders in matrix width', () => {
  const stages = executionStages([issue(1, 99)], metadata)
  expect(executionMatrixMinWidth(stages)).toBe(1250)
})
