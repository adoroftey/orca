import { IssueStatusBadge } from './issue-presentation/IssueStatusBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

export function ItsaplanSelect({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string
  value: string
  options: { value: string; label: string; color?: string; stateType?: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className="h-8 w-full min-w-0">
        <SelectValue placeholder={label}>
          {(() => {
            const selected = options.find((option) => option.value === value)
            return selected?.stateType !== undefined ? (
              <IssueStatusBadge
                name={selected.label}
                color={selected.color}
                stateType={selected.stateType}
              />
            ) : (
              selected?.label
            )
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} textValue={option.label}>
            {option.stateType !== undefined ? (
              <IssueStatusBadge
                name={option.label}
                color={option.color}
                stateType={option.stateType}
              />
            ) : (
              option.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
