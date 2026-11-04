import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanApi,
  ItsaplanConnectArgs,
  ItsaplanConnectionStatus,
  ItsaplanProject
} from '../../../../../shared/itsaplan/types'
import { ItsaplanConnectionForm } from './ConnectionForm'
import { ItsaplanSelect } from './ItsaplanSelect'
import type { ItsaplanWorkspaceActions } from './ProjectTasks'
import { PlanningShell } from './PlanningShell'
import { itsaplanErrorMessage, readItsaplanProject, saveItsaplanProject } from './request-state'

type Props = { api: ItsaplanApi; hostKey: string } & ItsaplanWorkspaceActions

export function ItsaplanTasks(props: Props) {
  return <ItsaplanHostTasks key={props.hostKey} {...props} />
}

function ItsaplanHostTasks({ api, hostKey, ...workspaceActions }: Props) {
  const alive = useRef(true)
  const [connection, setConnection] = useState<ItsaplanConnectionStatus | null>(null)
  const [projects, setProjects] = useState<ItsaplanProject[]>([])
  const [projectRef, setProjectRef] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    alive.current = true
    let active = true
    setLoading(true)
    setError(null)
    setProjects([])
    setProjectRef('')
    void api
      .status()
      .then(async (status) => {
        if (!active) {
          return
        }
        setConnection(status)
        if (status.connected) {
          const nextProjects = await api.listProjects()
          if (!active) {
            return
          }
          setProjects(nextProjects)
          const saved = status.baseUrl ? readItsaplanProject(hostKey, status.baseUrl) : null
          setProjectRef(
            nextProjects.find((project) => project.ref === saved)?.ref ?? nextProjects[0]?.ref ?? ''
          )
        }
      })
      .catch((failure) => {
        if (active) {
          setError(itsaplanErrorMessage(failure))
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
      alive.current = false
    }
  }, [api, hostKey, retry])
  async function connect(args: ItsaplanConnectArgs) {
    setBusy(true)
    setError(null)
    try {
      const status = await api.connect(args)
      if (!alive.current) {
        return
      }
      setConnection(status)
      setProjects([])
      setProjectRef('')
      setConfiguring(false)
      const nextProjects = await api.listProjects()
      if (alive.current) {
        setConnection(status)
        setProjects(nextProjects)
        setProjectRef(nextProjects[0]?.ref ?? '')
        setConfiguring(false)
      }
    } catch (failure) {
      if (alive.current) {
        setError(itsaplanErrorMessage(failure))
      }
    } finally {
      if (alive.current) {
        setBusy(false)
      }
    }
  }
  const selectedProject = projects.find((project) => project.ref === projectRef)
  return (
    <div
      className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background text-foreground"
      data-task-provider="itsaplan"
    >
      {loading ? (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          {translate('itsaplan.connection.loading', "Loading It's a Plan…")}
        </p>
      ) : !connection?.connected || configuring ? (
        <ItsaplanConnectionForm
          connection={connection}
          busy={busy}
          error={error}
          onConnect={connect}
          onCancelSignIn={() => {
            void api.cancelConnect?.().catch((failure) => {
              if (alive.current) {
                setError(itsaplanErrorMessage(failure))
              }
            })
          }}
          onCancel={
            connection?.connected
              ? () => {
                  setConfiguring(false)
                  setError(null)
                }
              : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
            <div className="min-w-[min(100%,16rem)] flex-1">
              <ItsaplanSelect
                label={translate('itsaplan.project.label', 'Project')}
                value={projectRef}
                onChange={(ref) => {
                  setProjectRef(ref)
                  if (connection.baseUrl) {
                    saveItsaplanProject(hostKey, connection.baseUrl, ref)
                  }
                }}
                options={projects.map((project) => ({
                  value: project.ref,
                  label: `${project.ref} · ${project.name}`
                }))}
                disabled={busy || projects.length === 0}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfiguring(true)
                setError(null)
              }}
              disabled={busy}
            >
              {translate('itsaplan.connection.settings', 'Connection settings')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                setError(null)
                void api
                  .disconnect()
                  .then(() => {
                    if (alive.current) {
                      setConnection({ connected: false, baseUrl: null, webBaseUrl: null })
                      setProjects([])
                      setProjectRef('')
                    }
                  })
                  .catch((failure) => {
                    if (alive.current) {
                      setError(itsaplanErrorMessage(failure))
                    }
                  })
                  .finally(() => {
                    if (alive.current) {
                      setBusy(false)
                    }
                  })
              }}
            >
              {translate('itsaplan.connection.disconnect', 'Disconnect')}
            </Button>
          </div>
          {error ? (
            <div role="alert" className="space-y-2 p-3 text-sm text-destructive">
              <p>{error}</p>
              <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
                {translate('itsaplan.retry', 'Retry')}
              </Button>
            </div>
          ) : null}
          {selectedProject ? (
            <PlanningShell
              key={`${connection.baseUrl}:${selectedProject.ref}`}
              api={api}
              connection={connection}
              project={selectedProject}
              {...workspaceActions}
            />
          ) : busy ? (
            <p role="status" className="p-6 text-sm text-muted-foreground">
              {translate('itsaplan.project.loading', 'Loading projects…')}
            </p>
          ) : !error ? (
            <p className="p-6 text-sm text-muted-foreground">
              {translate(
                'itsaplan.project.emptyAccount',
                'No accessible projects. Check your account and project permissions.'
              )}{' '}
              <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
                {translate('itsaplan.retry', 'Retry')}
              </Button>
            </p>
          ) : null}
        </>
      )}
      {!loading && !connection && error ? (
        <Button
          variant="outline"
          className="m-3 self-start"
          onClick={() => setRetry((value) => value + 1)}
        >
          {translate('itsaplan.retry', 'Retry')}
        </Button>
      ) : null}
    </div>
  )
}
