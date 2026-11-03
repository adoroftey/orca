import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanApi,
  ItsaplanConnectionStatus,
  ItsaplanIssue,
  ItsaplanIssueSummary,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../shared/itsaplan/types'
import { ItsaplanIssueList } from './IssueList'
import { PaginationBar } from '../PaginationBar'
import { ItsaplanSelect } from './ItsaplanSelect'
import { ItsaplanIssueDetails } from './IssueDetails'
import { ItsaplanIssueForm } from './IssueForm'
import { itsaplanErrorMessage } from './request-state'

export type ItsaplanWorkspaceActions = {
  onUseIssue: (
    issue: ItsaplanIssue,
    project: ItsaplanProject,
    connection: ItsaplanConnectionStatus
  ) => void
  onOpenIssue?: (
    issue: ItsaplanIssue,
    project: ItsaplanProject,
    connection: ItsaplanConnectionStatus
  ) => void
  onAttachIssue?: (
    issue: ItsaplanIssue,
    project: ItsaplanProject,
    connection: ItsaplanConnectionStatus,
    workspaceId: string
  ) => Promise<void>
  workspaces?: { id: string; label: string }[]
  linkedWorkspaceName?: (
    issue: ItsaplanIssue,
    project: ItsaplanProject,
    connection: ItsaplanConnectionStatus
  ) => string | null
}

export function ItsaplanProjectTasks({
  api,
  connection,
  project,
  ...workspaceActions
}: {
  api: ItsaplanApi
  connection: ItsaplanConnectionStatus
  project: ItsaplanProject
} & ItsaplanWorkspaceActions) {
  const alive = useRef(true)
  const [metadata, setMetadata] = useState<ItsaplanProjectDetails | null>(null)
  const [issues, setIssues] = useState<ItsaplanIssueSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [column, setColumn] = useState('all')
  const [assignee, setAssignee] = useState('all')
  const [page, setPage] = useState(0)
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  useEffect(() => {
    alive.current = true
    let active = true
    setLoading(true)
    setError(null)
    setIssues([])
    void Promise.all([
      api.getProject(project.ref),
      query ? api.searchIssues(project.ref, query, 500) : api.listIssues(project.ref)
    ])
      .then(([details, rows]) => {
        if (active) {
          setMetadata(details)
          setIssues(rows)
          setPage(0)
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
  }, [api, project.ref, query, refresh])
  const visibleIssues = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (column === 'all' || issue.columnId === Number(column)) &&
          (assignee === 'all' ||
            (assignee === 'none' ? !issue.assigneeUserId : issue.assigneeUserId === assignee))
      ),
    [issues, column, assignee]
  )
  const totalPages = Math.max(1, Math.ceil(visibleIssues.length / 50))
  const currentPage = Math.min(page, totalPages - 1)
  const shownIssues = visibleIssues.slice(currentPage * 50, currentPage * 50 + 50)
  if (selectedIssueId !== null && metadata) {
    return (
      <ItsaplanIssueDetails
        key={selectedIssueId}
        api={api}
        issueId={selectedIssueId}
        issueUrl={
          connection.webBaseUrl || connection.baseUrl
            ? `${(connection.webBaseUrl ?? connection.baseUrl)?.replace(/\/+$/, '')}/issue/${selectedIssueId}`
            : undefined
        }
        metadata={metadata}
        onBack={() => setSelectedIssueId(null)}
        onChanged={() => setRefresh((value) => value + 1)}
        onUseIssue={(issue) => workspaceActions.onUseIssue(issue, project, connection)}
        onOpenIssue={
          workspaceActions.onOpenIssue
            ? (issue) => workspaceActions.onOpenIssue?.(issue, project, connection)
            : undefined
        }
        onAttachIssue={
          workspaceActions.onAttachIssue
            ? (issue, workspaceId) =>
                workspaceActions.onAttachIssue?.(issue, project, connection, workspaceId) ??
                Promise.resolve()
            : undefined
        }
        workspaces={workspaceActions.workspaces}
        linkedWorkspaceName={(issue) =>
          workspaceActions.linkedWorkspaceName?.(issue, project, connection) ?? null
        }
      />
    )
  }
  if (creating && metadata) {
    return (
      <section className="min-h-0 overflow-auto p-4 scrollbar-sleek">
        <h2 className="mb-4 text-base font-medium">
          {translate('itsaplan.issue.new', 'New issue')}
        </h2>
        <ItsaplanIssueForm
          metadata={metadata}
          busy={saving}
          error={createError}
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            if (saving) {
              return
            }
            setSaving(true)
            setCreateError(null)
            try {
              const created = await api.createIssue(project.ref, input)
              if (alive.current) {
                setCreating(false)
                setSelectedIssueId(created.id)
                setRefresh((value) => value + 1)
              }
            } catch (failure) {
              if (alive.current) {
                setCreateError(itsaplanErrorMessage(failure))
              }
            } finally {
              if (alive.current) {
                setSaving(false)
              }
            }
          }}
        />
      </section>
    )
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <form
          className="flex min-w-[min(100%,16rem)] flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setQuery(searchInput.trim())
          }}
        >
          <Input
            aria-label={translate('itsaplan.search.label', 'Search issues')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={translate(
              'itsaplan.search.placeholder',
              'Search title, description, or fields'
            )}
            className="h-8"
          />
          <Button type="submit" variant="outline" size="sm" disabled={loading}>
            {translate('itsaplan.search.submit', 'Search')}
          </Button>
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('')
                setQuery('')
              }}
            >
              {translate('itsaplan.search.clear', 'Clear search')}
            </Button>
          ) : null}
        </form>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {translate('itsaplan.refresh', 'Refresh')}
        </Button>
        <Button
          size="sm"
          disabled={
            !metadata ||
            loading ||
            metadata.columns.length === 0 ||
            metadata.permissions?.work_items?.create === false
          }
          onClick={() => {
            setCreateError(null)
            setCreating(true)
          }}
        >
          {translate('itsaplan.issue.new', 'New issue')}
        </Button>
      </div>
      {metadata ? (
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2">
          <ItsaplanSelect
            label={translate('itsaplan.filters.status', 'Filter by status')}
            value={column}
            onChange={(value) => {
              setColumn(value)
              setPage(0)
            }}
            options={[
              { value: 'all', label: translate('itsaplan.filters.allStatuses', 'All statuses') },
              ...metadata.columns.map((entry) => ({
                value: String(entry.id),
                label: entry.name,
                color: entry.color,
                stateType: entry.stateType
              }))
            ]}
            disabled={loading}
          />
          <ItsaplanSelect
            label={translate('itsaplan.filters.assignee', 'Filter by assignee')}
            value={assignee}
            onChange={(value) => {
              setAssignee(value)
              setPage(0)
            }}
            options={[
              { value: 'all', label: translate('itsaplan.filters.allAssignees', 'All assignees') },
              { value: 'none', label: translate('itsaplan.assignee.none', 'Unassigned') },
              ...metadata.assignees
                .filter((entry) => entry.kind === 'member')
                .map((entry) => ({ value: entry.userId, label: entry.name }))
            ]}
            disabled={loading}
          />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek">
        {loading ? (
          <p role="status" className="p-4 text-sm text-muted-foreground">
            {translate('itsaplan.issues.loading', 'Loading issues…')}
          </p>
        ) : error ? (
          <div role="alert" className="space-y-2 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button variant="outline" onClick={() => setRefresh((value) => value + 1)}>
              {translate('itsaplan.retry', 'Retry')}
            </Button>
          </div>
        ) : (
          <ItsaplanIssueList
            issues={shownIssues}
            allIssues={issues}
            totalCount={visibleIssues.length}
            expandMatches={Boolean(query) || column !== 'all' || assignee !== 'all'}
            metadata={metadata}
            searchCapped={Boolean(query) && issues.length >= 500}
            onSelect={setSelectedIssueId}
          />
        )}
      </div>
      {!loading && !error && totalPages > 1 ? (
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          loadingTarget={null}
          onPageChange={setPage}
        />
      ) : null}
    </>
  )
}
