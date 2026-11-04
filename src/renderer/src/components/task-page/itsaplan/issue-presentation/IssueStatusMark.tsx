import { Circle, CircleCheck, CircleDot } from 'lucide-react'
import { issueStatusColor } from './issue-status-color'

export function IssueStatusMark({ color, stateType }: { color?: string; stateType?: string }) {
  const Icon =
    stateType === 'completed' ? CircleCheck : stateType === 'started' ? CircleDot : Circle
  return (
    <Icon
      aria-hidden="true"
      className="inline-block size-3 shrink-0"
      style={{ color: issueStatusColor(color) }}
    />
  )
}
