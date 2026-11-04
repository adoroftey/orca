import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'

type Confirmation = 'delete' | 'publish' | null
export function ViewConfirmation({
  confirmation,
  setConfirmation,
  busy,
  onDelete,
  onPublish
}: {
  confirmation: Confirmation
  setConfirmation: (value: Confirmation) => void
  busy: boolean
  onDelete: () => void
  onPublish: () => void
}) {
  return (
    <Dialog
      open={confirmation !== null}
      onOpenChange={(open) => {
        if (!open) {
          setConfirmation(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {confirmation === 'delete'
              ? translate('itsaplan.planning.views.confirmDelete', 'Delete this view?')
              : translate('itsaplan.planning.views.confirmPublish', 'Publish this view?')}
          </DialogTitle>
          <DialogDescription>
            {confirmation === 'delete'
              ? translate('itsaplan.planning.views.deleteDescription', 'This view will be deleted.')
              : translate(
                  'itsaplan.planning.views.publishDescription',
                  'This view will be shared with the project.'
                )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmation(null)}>
            {translate('itsaplan.planning.views.cancel', 'Cancel')}
          </Button>
          <Button
            variant={confirmation === 'delete' ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => {
              const action = confirmation
              setConfirmation(null)
              if (action === 'delete') {
                onDelete()
              } else if (action === 'publish') {
                onPublish()
              }
            }}
          >
            {confirmation === 'delete'
              ? translate('itsaplan.planning.views.delete', 'Delete')
              : translate('itsaplan.planning.views.publish', 'Publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
