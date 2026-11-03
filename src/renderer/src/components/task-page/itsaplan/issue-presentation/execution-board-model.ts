import { translate } from '@/i18n/i18n'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'

export type ExecutionStage = {
  key: string
  columnId: number | null
  name: string
  stateType: string
  count: number
}
export type ExecutionRow = {
  key: string
  parentId: number | null
  parent: ItsaplanIssueSummary | null
  parentInResults: boolean
  issues: ItsaplanIssueSummary[]
  totalChildren: number
  completedChildren: number
  canceledChildren: number
}
export const EXECUTION_ROW_HEADER_WIDTH = 224
export const EXECUTION_STAGE_MIN_WIDTH = 256

export function issueExecutionStageKey(
  issue: ItsaplanIssueSummary,
  metadata: ItsaplanProjectDetails | null
): string {
  return metadata?.columns.some((column) => column.id === issue.columnId)
    ? String(issue.columnId)
    : 'unknown'
}
export function executionStages(
  issues: ItsaplanIssueSummary[],
  metadata: ItsaplanProjectDetails | null
): ExecutionStage[] {
  const counts = new Map<string, number>()
  for (const issue of issues) {
    const key = issueExecutionStageKey(issue, metadata)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const stages: ExecutionStage[] = (metadata?.columns ?? []).map((column) => ({
    key: String(column.id),
    columnId: column.id,
    name: column.name,
    stateType: column.stateType,
    count: counts.get(String(column.id)) ?? 0
  }))
  if (counts.has('unknown')) {
    stages.push({
      key: 'unknown',
      columnId: null,
      name: translate('itsaplan.execution.unknown', 'Unknown'),
      stateType: 'unknown',
      count: counts.get('unknown')!
    })
  }
  return stages
}
export function executionMatrixMinWidth(stages: ExecutionStage[]): number {
  return EXECUTION_ROW_HEADER_WIDTH + stages.length * EXECUTION_STAGE_MIN_WIDTH + 2
}
export function buildExecutionRows(
  issues: ItsaplanIssueSummary[],
  allIssues: ItsaplanIssueSummary[],
  metadata: ItsaplanProjectDetails | null
): ExecutionRow[] {
  const byId = new Map([...allIssues, ...issues].map((issue) => [issue.id, issue]))
  const rootFor = (issue: ItsaplanIssueSummary): ItsaplanIssueSummary | null => {
    let current = issue
    const seen = new Set<number>()
    while (current.parentId != null) {
      if (seen.has(current.id)) {
        return null
      }
      seen.add(current.id)
      const parent = byId.get(current.parentId)
      if (!parent) {
        return null
      }
      current = parent
    }
    return current
  }
  const rootsWithChildren = new Set<number>()
  for (const issue of byId.values()) {
    const root = rootFor(issue)
    if (root && root.id !== issue.id) {
      rootsWithChildren.add(root.id)
    }
  }
  const selected = new Set(issues.map((issue) => issue.id))
  const rows = new Map<string, ExecutionRow>()
  for (const issue of issues) {
    const root = rootFor(issue)
    const parent = root && rootsWithChildren.has(root.id) ? root : null
    const key = parent ? String(parent.id) : 'ungrouped'
    let row = rows.get(key)
    if (!row) {
      const children = parent
        ? allIssues.filter((item) => item.id !== parent.id && rootFor(item)?.id === parent.id)
        : []
      const state = (item: ItsaplanIssueSummary) =>
        metadata?.columns.find((column) => column.id === item.columnId)?.stateType
      row = {
        key,
        parentId: parent?.id ?? null,
        parent,
        parentInResults: !!parent && selected.has(parent.id),
        issues: [],
        totalChildren: children.length,
        completedChildren: children.filter((item) => state(item) === 'completed').length,
        canceledChildren: children.filter((item) => state(item) === 'canceled').length
      }
      rows.set(key, row)
    }
    if (!row.issues.some((item) => item.id === issue.id)) {
      row.issues.push(issue)
    }
  }
  return [...rows.values()]
}
