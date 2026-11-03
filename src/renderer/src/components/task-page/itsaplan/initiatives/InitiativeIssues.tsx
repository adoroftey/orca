import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanApi,
  ItsaplanIssue,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningInitiative
} from '../../../../../../shared/itsaplan/planning-types'
import { ItsaplanIssueForm } from '../IssueForm'
import { ItsaplanSelect } from '../ItsaplanSelect'
import { IssueStatusBoard } from '../issue-presentation/IssueStatusBoard'
export function InitiativeIssues({
  api,
  planning,
  projectRef,
  initiativeId,
  metadata,
  onOpenIssue,
  refreshVersion = 0
}: {
  api: ItsaplanApi
  planning: ItsaplanPlanningApi
  projectRef: string
  initiativeId: number
  metadata: ItsaplanProjectDetails
  onOpenIssue: (id: number) => void
  refreshVersion?: number
}) {
  const [issues, setIssues] = useState<ItsaplanIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const [choice, setChoice] = useState('none')
  const [creating, setCreating] = useState(false)
  const [target, setTarget] = useState(String(initiativeId))
  const [initiatives, setInitiatives] = useState<PlanningInitiative[]>([])
  useEffect(() => {
    if (!creating) {
      return
    }
    let active = true
    const load = async () => {
      const all: PlanningInitiative[] = []
      let page = 1
      while (active) {
        const result = await planning.listInitiatives(projectRef, { page, pageSize: 100 })
        all.push(...result.items)
        if (!result.items.length || all.length >= result.total) {
          break
        }
        page++
      }
      if (active) {
        setInitiatives(all)
      }
    }
    void load().catch(() => {
      if (active) {
        setError(
          translate('itsaplan.planning.initiatives.listError', 'Unable to load initiatives.')
        )
      }
    })
    return () => {
      active = false
    }
  }, [creating, planning, projectRef])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .listIssues(projectRef)
      .then((items) => {
        if (active) {
          setIssues(items)
        }
      })
      .catch(() => {
        if (active) {
          setError(translate('itsaplan.planning.initiatives.issuesError', 'Unable to load issues.'))
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
  }, [api, projectRef, initiativeId, version, refreshVersion])
  const lifetime = useRef(true)
  useEffect(() => {
    lifetime.current = true
    return () => {
      lifetime.current = false
    }
  }, [])
  const linked = (issue: ItsaplanIssue) =>
    issue.initiative?.id === initiativeId || issue.initiativeId === initiativeId
  const canEdit = metadata.permissions?.work_items?.edit === true
  const canCreate = metadata.permissions?.work_items?.create === true
  const update = async (id: number, value: number | null) => {
    setBusy(true)
    setError(null)
    try {
      await api.updateIssue(id, { initiativeId: value })
      if (lifetime.current) {
        setVersion((v) => v + 1)
        setChoice('none')
      }
    } catch {
      if (lifetime.current) {
        setError(
          translate('itsaplan.planning.initiatives.issueUpdateError', 'Unable to update issue.')
        )
      }
    } finally {
      if (lifetime.current) {
        setBusy(false)
      }
    }
  }
  return (
    <section className="space-y-2">
      <h3>{translate('itsaplan.planning.initiatives.issues', 'Linked issues')}</h3>
      {loading ? (
        <p>{translate('itsaplan.planning.initiatives.issuesLoading', 'Loading issues…')}</p>
      ) : (
        <>
          {issues.some(linked) ? (
            <IssueStatusBoard
              issues={issues.filter(linked)}
              allIssues={issues}
              metadata={metadata}
              onOpenIssue={onOpenIssue}
              renderActions={(issue) =>
                canEdit && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void update(issue.id, null)}
                  >
                    {translate('itsaplan.planning.initiatives.unlink', 'Unlink')}
                  </Button>
                )
              }
            />
          ) : (
            <p>{translate('itsaplan.planning.initiatives.issuesEmpty', 'No linked issues.')}</p>
          )}
          {canEdit && issues.some((issue) => !linked(issue)) && (
            <div className="flex gap-2">
              <ItsaplanSelect
                label={translate('itsaplan.planning.initiatives.chooseIssue', 'Choose issue')}
                value={choice}
                onChange={setChoice}
                options={[
                  {
                    value: 'none',
                    label: translate('itsaplan.planning.initiatives.chooseIssue', 'Choose issue')
                  },
                  ...issues
                    .filter((issue) => !linked(issue))
                    .map((issue) => ({
                      value: String(issue.id),
                      label: `${issue.identifier} ${issue.title}`
                    }))
                ]}
              />
              <Button
                disabled={busy || choice === 'none'}
                onClick={() => void update(Number(choice), initiativeId)}
              >
                {translate('itsaplan.planning.initiatives.link', 'Link issue')}
              </Button>
            </div>
          )}
          {canCreate && !creating && (
            <Button onClick={() => setCreating(true)}>
              {translate('itsaplan.planning.initiatives.newIssue', 'New issue')}
            </Button>
          )}
          {creating && (
            <>
              <ItsaplanSelect
                label={translate(
                  'itsaplan.planning.initiatives.issueInitiative',
                  'Issue initiative'
                )}
                value={target}
                onChange={setTarget}
                options={[
                  {
                    value: 'none',
                    label: translate('itsaplan.planning.initiatives.noInitiative', 'No initiative')
                  },
                  ...(initiatives.some((i) => i.id === initiativeId)
                    ? []
                    : [
                        {
                          value: String(initiativeId),
                          label: translate(
                            'itsaplan.planning.initiatives.currentInitiative',
                            'Current initiative'
                          )
                        }
                      ]),
                  ...initiatives.map((i) => ({ value: String(i.id), label: i.title }))
                ]}
              />
              <ItsaplanIssueForm
                metadata={metadata}
                busy={busy}
                error={error}
                onCancel={() => setCreating(false)}
                onSubmit={async (input) => {
                  setBusy(true)
                  setError(null)
                  try {
                    await api.createIssue(projectRef, {
                      ...input,
                      initiativeId: target === 'none' ? null : Number(target)
                    })
                    if (lifetime.current) {
                      setCreating(false)
                      setVersion((v) => v + 1)
                    }
                  } catch {
                    if (lifetime.current) {
                      setError(
                        translate(
                          'itsaplan.planning.initiatives.issueCreateError',
                          'Unable to create issue.'
                        )
                      )
                    }
                  } finally {
                    if (lifetime.current) {
                      setBusy(false)
                    }
                  }
                }}
              />
            </>
          )}
        </>
      )}
      {error && !creating && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
