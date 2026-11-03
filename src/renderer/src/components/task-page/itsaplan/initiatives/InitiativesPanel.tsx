import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanApi,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningInitiative
} from '../../../../../../shared/itsaplan/planning-types'
import { ItsaplanSelect } from '../ItsaplanSelect'
import { InitiativeDetail } from './InitiativeDetail'
import { InitiativeForm, initiativeValueLabel } from './InitiativeForm'
export function ItsaplanInitiativesPanel(props: {
  api: ItsaplanApi
  planning: ItsaplanPlanningApi
  project: ItsaplanProject
  metadata: ItsaplanProjectDetails
  onOpenIssue: (issueId: number) => void
  refreshVersion?: number
}) {
  return <InitiativesPanel key={props.project.ref} {...props} />
}
function InitiativesPanel({
  api,
  planning,
  project,
  metadata,
  onOpenIssue,
  refreshVersion = 0
}: {
  api: ItsaplanApi
  planning: ItsaplanPlanningApi
  project: ItsaplanProject
  metadata: ItsaplanProjectDetails
  onOpenIssue: (issueId: number) => void
  refreshVersion?: number
}) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [items, setItems] = useState<PlanningInitiative[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const canRead =
    metadata.permissions?.initiatives?.read === true && project.initiativesEnabled !== false
  useEffect(() => {
    if (!canRead) {
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    planning
      .listInitiatives(project.ref, {
        page,
        pageSize: 20,
        ...(search ? { search } : {}),
        ...(status !== 'all' ? { status } : {})
      })
      .then((result) => {
        if (active) {
          setItems(result.items)
          setTotal(result.total)
        }
      })
      .catch(() => {
        if (active) {
          setError(
            translate('itsaplan.planning.initiatives.listError', 'Unable to load initiatives.')
          )
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [planning, project.ref, page, search, status, version, canRead, refreshVersion])
  const lifetime = useRef(true)
  useEffect(() => {
    lifetime.current = true
    return () => {
      lifetime.current = false
    }
  }, [])
  if (!canRead) {
    return (
      <p>
        {translate(
          'itsaplan.planning.initiatives.noAccess',
          'Initiatives are unavailable for this project.'
        )}
      </p>
    )
  }
  if (selected !== null) {
    return (
      <InitiativeDetail
        key={`${project.ref}:${selected}`}
        api={api}
        planning={planning}
        id={selected}
        projectRef={project.ref}
        metadata={metadata}
        onBack={() => setSelected(null)}
        onChanged={() => setVersion((v) => v + 1)}
        onOpenIssue={onOpenIssue}
        refreshVersion={refreshVersion}
      />
    )
  }
  if (creating) {
    return (
      <InitiativeForm
        key={project.ref}
        metadata={metadata}
        busy={busy}
        error={error}
        onCancel={() => {
          setCreating(false)
          setError(null)
        }}
        onSave={(input) => {
          if (!input.title) {
            return
          }
          setBusy(true)
          setError(null)
          const ref = project.ref
          void planning
            .createInitiative(ref, { ...input, title: input.title })
            .then(() => {
              if (lifetime.current) {
                setCreating(false)
                setVersion((v) => v + 1)
              }
            })
            .catch(() => {
              if (lifetime.current) {
                setError(
                  translate(
                    'itsaplan.planning.initiatives.createError',
                    'Unable to create initiative.'
                  )
                )
              }
            })
            .finally(() => {
              if (lifetime.current) {
                setBusy(false)
              }
            })
        }}
      />
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label={translate('itsaplan.planning.initiatives.search', 'Search initiatives')}
          placeholder={translate('itsaplan.planning.initiatives.search', 'Search initiatives')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <ItsaplanSelect
          label={translate('itsaplan.planning.initiatives.filterStatus', 'Filter by status')}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          options={['all', 'proposed', 'planned', 'active', 'completed', 'canceled'].map((v) => ({
            value: v,
            label: initiativeValueLabel(v)
          }))}
        />
        <Button onClick={() => setVersion((v) => v + 1)}>
          {translate('itsaplan.planning.initiatives.refresh', 'Refresh')}
        </Button>
        {metadata.permissions?.initiatives?.create === true && (
          <Button
            onClick={() => {
              setError(null)
              setCreating(true)
            }}
          >
            {translate('itsaplan.planning.initiatives.new', 'New initiative')}
          </Button>
        )}
      </div>
      {loading && (
        <p>{translate('itsaplan.planning.initiatives.listLoading', 'Loading initiatives…')}</p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!loading && !error && (
        <>
          {items.map((item) => (
            <div key={item.id}>
              <Button variant="link" onClick={() => setSelected(item.id)}>
                {item.title}
              </Button>
              <span>{initiativeValueLabel(item.status)}</span>
            </div>
          ))}
          {!items.length && (
            <p>{translate('itsaplan.planning.initiatives.listEmpty', 'No initiatives found.')}</p>
          )}
          <div className="flex gap-2">
            <Button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
              {translate('itsaplan.planning.initiatives.previousPage', 'Previous page')}
            </Button>
            <span>{page}</span>
            <Button disabled={page * 20 >= total} onClick={() => setPage((v) => v + 1)}>
              {translate('itsaplan.planning.initiatives.nextPage', 'Next page')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
