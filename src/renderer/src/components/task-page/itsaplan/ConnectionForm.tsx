import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanConnectArgs,
  ItsaplanConnectionStatus
} from '../../../../../shared/itsaplan/types'

export function ItsaplanConnectionForm({
  connection,
  busy,
  error,
  onConnect,
  onCancel
}: {
  connection: ItsaplanConnectionStatus | null
  busy: boolean
  error: string | null
  onConnect: (args: ItsaplanConnectArgs) => Promise<void>
  onCancel?: () => void
}) {
  const id = useId()
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? '')
  const [webBaseUrl, setWebBaseUrl] = useState(connection?.webBaseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  return (
    <form
      className="mx-auto my-6 flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
      onSubmit={(event) => {
        event.preventDefault()
        if (!busy && baseUrl.trim() && apiKey.trim()) {
          void onConnect({
            baseUrl: baseUrl.trim(),
            ...(webBaseUrl.trim() ? { webBaseUrl: webBaseUrl.trim() } : {}),
            apiKey: apiKey.trim()
          })
        }
      }}
    >
      <h2 className="text-base font-medium">
        {translate('itsaplan.connect.title', "Connect It's a Plan")}
      </h2>
      <div className="space-y-2">
        <Label htmlFor={`${id}-api`}>{translate('itsaplan.connect.apiUrl', 'API URL')}</Label>
        <Input
          id={`${id}-api`}
          type="url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={translate(
            'itsaplan.connect.apiUrlPlaceholder',
            'https://api.plan.example.com'
          )}
          required
          disabled={busy}
          aria-invalid={Boolean(error)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-web`}>
          {translate('itsaplan.connect.webUrl', 'Web URL (optional)')}
        </Label>
        <Input
          id={`${id}-web`}
          type="url"
          value={webBaseUrl}
          onChange={(event) => setWebBaseUrl(event.target.value)}
          placeholder={translate('itsaplan.connect.webUrlPlaceholder', 'https://plan.example.com')}
          disabled={busy}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-key`}>{translate('itsaplan.connect.apiKey', 'API key')}</Label>
        <Input
          id={`${id}-key`}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          autoComplete="off"
          required
          disabled={busy}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy || !baseUrl.trim() || !apiKey.trim()}>
          {busy
            ? translate('itsaplan.connect.connecting', 'Connecting…')
            : translate('itsaplan.connect.connect', 'Connect')}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {translate('itsaplan.cancel', 'Cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
