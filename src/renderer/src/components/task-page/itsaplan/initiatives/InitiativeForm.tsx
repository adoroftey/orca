import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import type { ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import type {
  PlanningInitiative,
  PlanningInitiativeInput
} from '../../../../../../shared/itsaplan/planning-types'
import { ItsaplanSelect } from '../ItsaplanSelect'

export function initiativeValueLabel(value: string): string {
  switch (value) {
    case 'all':
      return translate('itsaplan.planning.initiatives.statusAll', 'All statuses')
    case 'proposed':
      return translate('itsaplan.planning.initiatives.statusProposed', 'Proposed')
    case 'planned':
      return translate('itsaplan.planning.initiatives.statusPlanned', 'Planned')
    case 'active':
      return translate('itsaplan.planning.initiatives.statusActive', 'Active')
    case 'completed':
      return translate('itsaplan.planning.initiatives.statusCompleted', 'Completed')
    case 'canceled':
      return translate('itsaplan.planning.initiatives.statusCanceled', 'Canceled')
    case 'none':
      return translate('itsaplan.planning.initiatives.priorityNone', 'None')
    case 'urgent':
      return translate('itsaplan.planning.initiatives.priorityUrgent', 'Urgent')
    case 'high':
      return translate('itsaplan.planning.initiatives.priorityHigh', 'High')
    case 'medium':
      return translate('itsaplan.planning.initiatives.priorityMedium', 'Medium')
    case 'low':
      return translate('itsaplan.planning.initiatives.priorityLow', 'Low')
    default:
      return value
  }
}
function isStatus(value: string): value is NonNullable<PlanningInitiativeInput['status']> {
  return (
    value === 'proposed' ||
    value === 'planned' ||
    value === 'active' ||
    value === 'completed' ||
    value === 'canceled'
  )
}
export function InitiativeForm({
  item,
  metadata,
  busy,
  error,
  onSave,
  onCancel
}: {
  item?: PlanningInitiative
  metadata: ItsaplanProjectDetails
  busy: boolean
  error: string | null
  onSave: (input: PlanningInitiativeInput | Partial<PlanningInitiativeInput>) => void
  onCancel: () => void
}) {
  const id = useId()
  const [title, setTitle] = useState(item?.title ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [status, setStatus] = useState(item?.status ?? 'proposed')
  const [owner, setOwner] = useState(item?.ownerUserId ?? '')
  const [priority, setPriority] = useState(item?.priority ?? '')
  const [startDate, setStartDate] = useState(item?.startDate ?? '')
  const [targetDate, setTargetDate] = useState(item?.targetDate ?? '')
  const [labels, setLabels] = useState<number[]>(item?.labelIds ?? [])
  const statuses = ['proposed', 'planned', 'active', 'completed', 'canceled']
  const selectOptions = (values: string[]) =>
    values.map((value) => ({ value, label: initiativeValueLabel(value) }))
  const owners = [
    { value: 'none', label: translate('itsaplan.planning.initiatives.unassigned', 'Unassigned') },
    ...metadata.assignees.map((a) => ({ value: a.userId, label: a.name }))
  ]
  if (owner && !owners.some((a) => a.value === owner)) {
    owners.push({ value: owner, label: owner })
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim() || busy) {
          return
        }
        const values = {
          title: title.trim(),
          description,
          ownerUserId: owner || null,
          priority: priority || null,
          startDate: startDate || null,
          targetDate: targetDate || null,
          labelIds: labels
        }
        const patch: Partial<PlanningInitiativeInput> = {}
        if (!item || values.title !== item.title) {
          patch.title = values.title
        }
        if (!item || values.description !== item.description) {
          patch.description = values.description
        }
        if (!item || values.ownerUserId !== item.ownerUserId) {
          patch.ownerUserId = values.ownerUserId
        }
        if (!item || values.priority !== item.priority) {
          patch.priority = values.priority
        }
        if (!item || values.startDate !== item.startDate) {
          patch.startDate = values.startDate
        }
        if (!item || values.targetDate !== item.targetDate) {
          patch.targetDate = values.targetDate
        }
        if (!item || JSON.stringify(values.labelIds) !== JSON.stringify(item.labelIds)) {
          patch.labelIds = values.labelIds
        }
        if (isStatus(status) && (!item || status !== item.status)) {
          patch.status = status
        }
        onSave(patch)
      }}
    >
      <Label htmlFor={`${id}-title`}>
        {translate('itsaplan.planning.initiatives.title', 'Title')}
      </Label>
      <Input
        id={`${id}-title`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={busy}
        required
      />
      <Label htmlFor={`${id}-description`}>
        {translate('itsaplan.planning.initiatives.description', 'Description')}
      </Label>
      <Textarea
        id={`${id}-description`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={busy}
      />
      <ItsaplanSelect
        label={translate('itsaplan.planning.initiatives.status', 'Status')}
        value={status}
        onChange={setStatus}
        options={selectOptions(statuses.includes(status) ? statuses : [status, ...statuses])}
        disabled={busy}
      />
      <ItsaplanSelect
        label={translate('itsaplan.planning.initiatives.owner', 'Owner')}
        value={owner || 'none'}
        onChange={(v) => setOwner(v === 'none' ? '' : v)}
        options={owners}
        disabled={busy}
      />
      <ItsaplanSelect
        label={translate('itsaplan.planning.initiatives.priority', 'Priority')}
        value={priority || 'none'}
        onChange={(v) => setPriority(v === 'none' ? '' : v)}
        options={selectOptions([
          'none',
          ...new Set(['urgent', 'high', 'medium', 'low', ...(priority ? [priority] : [])])
        ])}
        disabled={busy}
      />
      <Label htmlFor={`${id}-start`}>
        {translate('itsaplan.planning.initiatives.startDate', 'Start date')}
      </Label>
      <Input
        id={`${id}-start`}
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        disabled={busy}
      />
      <Label htmlFor={`${id}-target`}>
        {translate('itsaplan.planning.initiatives.targetDate', 'Target date')}
      </Label>
      <Input
        id={`${id}-target`}
        type="date"
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        disabled={busy}
      />
      <fieldset disabled={busy}>
        <legend>{translate('itsaplan.planning.initiatives.labels', 'Labels')}</legend>
        {metadata.labels?.map((label) => (
          <label key={label.id} className="mr-3">
            <input
              type="checkbox"
              checked={labels.includes(label.id)}
              onChange={(e) =>
                setLabels(
                  e.target.checked ? [...labels, label.id] : labels.filter((v) => v !== label.id)
                )
              }
            />{' '}
            {label.name}
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={busy || !title.trim()} type="submit">
          {translate('itsaplan.planning.initiatives.save', 'Save')}
        </Button>
        <Button disabled={busy} type="button" variant="ghost" onClick={onCancel}>
          {translate('itsaplan.planning.initiatives.cancel', 'Cancel')}
        </Button>
      </div>
    </form>
  )
}

export function InitiativeDeleteDialog({
  open,
  busy,
  onOpenChange,
  onDelete
}: {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate('itsaplan.planning.initiatives.deleteTitle', 'Delete initiative?')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'itsaplan.planning.initiatives.deleteDescription',
              'This action cannot be undone.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            {translate('itsaplan.planning.initiatives.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={onDelete}>
            {translate('itsaplan.planning.initiatives.delete', 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
