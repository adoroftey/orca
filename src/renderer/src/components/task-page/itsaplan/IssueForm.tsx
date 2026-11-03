import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanIssue,
  ItsaplanIssueCreate,
  ItsaplanProjectDetails
} from '../../../../../shared/itsaplan/types'
import { ItsaplanSelect } from './ItsaplanSelect'

export function ItsaplanIssueForm({
  issue,
  metadata,
  busy,
  error,
  onSubmit,
  onCancel
}: {
  issue?: ItsaplanIssue
  metadata: ItsaplanProjectDetails
  busy: boolean
  error: string | null
  onSubmit: (input: ItsaplanIssueCreate) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const [title, setTitle] = useState(issue?.title ?? '')
  const [description, setDescription] = useState(issue?.description ?? '')
  const [columnId, setColumnId] = useState(String(issue?.columnId ?? metadata.columns[0]?.id ?? ''))
  const [priority, setPriority] = useState(issue?.priority ?? 'none')
  const [assignee, setAssignee] = useState(issue?.assigneeUserId ?? 'none')
  const priorities = [
    { value: 'none', label: translate('itsaplan.priority.none', 'No priority') },
    { value: 'urgent', label: translate('itsaplan.priority.urgent', 'Urgent') },
    { value: 'high', label: translate('itsaplan.priority.high', 'High') },
    { value: 'medium', label: translate('itsaplan.priority.medium', 'Medium') },
    { value: 'low', label: translate('itsaplan.priority.low', 'Low') }
  ]
  if (!priorities.some((entry) => entry.value === priority)) {
    priorities.push({ value: priority, label: priority })
  }
  const members = metadata.assignees.filter((member) => member.kind === 'member')
  const assignees = [
    { value: 'none', label: translate('itsaplan.assignee.none', 'Unassigned') },
    ...members.map((member) => ({ value: member.userId, label: member.name }))
  ]
  if (assignee !== 'none' && !assignees.some((member) => member.value === assignee)) {
    assignees.push({ value: assignee, label: assignee })
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy && title.trim() && columnId) {
          void onSubmit({
            title: title.trim(),
            description,
            columnId: Number(columnId),
            priority: priority === 'none' ? null : priority,
            assigneeUserId: assignee === 'none' ? null : assignee
          })
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${id}-title`}>{translate('itsaplan.issue.title', 'Title')}</Label>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={500}
          disabled={busy}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-description`}>
          {translate('itsaplan.issue.description', 'Description')}
        </Label>
        <Textarea
          id={`${id}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={50000}
          rows={8}
          disabled={busy}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ItsaplanSelect
          label={translate('itsaplan.issue.status', 'Status')}
          value={columnId}
          onChange={setColumnId}
          options={metadata.columns.map((column) => ({
            value: String(column.id),
            label: column.name
          }))}
          disabled={busy}
        />
        <ItsaplanSelect
          label={translate('itsaplan.issue.priority', 'Priority')}
          value={priority}
          onChange={setPriority}
          options={priorities}
          disabled={busy}
        />
        <ItsaplanSelect
          label={translate('itsaplan.issue.assignee', 'Assignee')}
          value={assignee}
          onChange={setAssignee}
          options={assignees}
          disabled={busy}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !title.trim() || !columnId}>
          {busy
            ? translate('itsaplan.issue.saving', 'Saving…')
            : issue
              ? translate('itsaplan.issue.save', 'Save changes')
              : translate('itsaplan.issue.create', 'Create issue')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          {translate('itsaplan.cancel', 'Cancel')}
        </Button>
      </div>
    </form>
  )
}
