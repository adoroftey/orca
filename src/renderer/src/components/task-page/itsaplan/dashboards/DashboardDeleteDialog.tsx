import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertDialog } from 'radix-ui'
import { translate } from '@/i18n/i18n'

export function DashboardDeleteDialog({
  disabled,
  onConfirm
}: {
  disabled: boolean
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        {translate('itsaplan.planning.dashboards.delete', 'Delete')}
      </Button>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded border bg-background p-6 shadow-lg">
            <AlertDialog.Title>
              {translate('itsaplan.planning.dashboards.confirmDelete', 'Delete this dashboard?')}
            </AlertDialog.Title>
            <AlertDialog.Description>
              {translate(
                'itsaplan.planning.dashboards.deleteDescription',
                'This dashboard will be permanently deleted.'
              )}
            </AlertDialog.Description>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {translate('itsaplan.planning.dashboards.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={() => {
                  setOpen(false)
                  onConfirm()
                }}
              >
                {translate('itsaplan.planning.dashboards.delete', 'Delete')}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}
