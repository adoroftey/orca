import { Badge } from '@/components/ui/badge'
import { issueStatusColor } from './issue-status-color'
import { IssueStatusMark } from './IssueStatusMark'

export function IssueStatusBadge({
  name,
  color,
  stateType
}: {
  name: string
  color?: string
  stateType?: string
}) {
  return (
    <Badge variant="outline" style={{ borderColor: issueStatusColor(color) }}>
      <IssueStatusMark color={color} stateType={stateType} />
      {name}
    </Badge>
  )
}
