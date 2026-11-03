import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { openAppHttpLink } from '@/lib/app-http-link-open'
import type {
  ItsaplanApi,
  ItsaplanComment,
  ItsaplanCommentCursor,
  ItsaplanIssue,
  ItsaplanIssueCreate,
  ItsaplanProjectDetails
} from '../../../../../shared/itsaplan/types'
import { ItsaplanIssueForm } from './IssueForm'
import { itsaplanErrorMessage } from './request-state'
import { ItsaplanSelect } from './ItsaplanSelect'

const EMPTY_WORKSPACES: { id: string; label: string }[] = []

export function ItsaplanIssueDetails({
  api,
  issueId,
  issueUrl,
  metadata,
  onBack,
  onChanged,
  onUseIssue,
  onOpenIssue,
  onAttachIssue,
  workspaces = EMPTY_WORKSPACES,
  linkedWorkspaceName
}: {
  api: ItsaplanApi
  issueId: number
  issueUrl?: string
  metadata: ItsaplanProjectDetails
  onBack: () => void
  onChanged: () => void
  onUseIssue: (issue: ItsaplanIssue) => void
  onOpenIssue?: (issue: ItsaplanIssue) => void
  onAttachIssue?: (issue: ItsaplanIssue, workspaceId: string) => Promise<void>
  workspaces?: { id: string; label: string }[]
  linkedWorkspaceName?: (issue: ItsaplanIssue) => string | null
}) {
  const id = useId()
  const alive = useRef(true)
  const [issue, setIssue] = useState<ItsaplanIssue | null>(null)
  const [comments, setComments] = useState<ItsaplanComment[]>([])
  const [cursor, setCursor] = useState<ItsaplanCommentCursor | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState('')
  const [attaching, setAttaching] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  useEffect(() => {
    alive.current = true
    let active = true
    setLoading(true)
    setError(null)
    void Promise.all([api.getIssue(issueId), api.listComments(issueId, { limit: 100 })])
      .then(([nextIssue, page]) => {
        if (active) {
          setIssue(nextIssue)
          setComments(page.items)
          setCursor(page.nextCursor)
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
  }, [api, issueId, retry])
  async function mutate(action: () => Promise<void>) {
    if (busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await action()
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
  async function save(input: ItsaplanIssueCreate) {
    await mutate(async () => {
      const updated = await api.updateIssue(issueId, input)
      if (alive.current) {
        setIssue(updated)
        setEditing(false)
        onChanged()
      }
    })
  }
  const canEdit = metadata.permissions?.work_items?.edit !== false
  const linkedName = issue ? linkedWorkspaceName?.(issue) : null
  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 scrollbar-sleek"
      aria-label={translate('itsaplan.issue.details', 'Issue details')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          {translate('itsaplan.issue.back', 'Back to issues')}
        </Button>
        {issue && !editing ? (
          <div className="flex flex-wrap gap-2">
            {issueUrl ? (
              <Button
                variant="outline"
                onClick={(event) => openAppHttpLink(issueUrl, { event })}
                disabled={busy}
              >
                {translate('itsaplan.issue.openExternal', "Open in It's a Plan")}
              </Button>
            ) : null}
            {linkedName && onOpenIssue ? (
              <Button variant="outline" onClick={() => onOpenIssue(issue)} disabled={busy}>
                {translate('itsaplan.workspace.open', 'Open workspace')}: {linkedName}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => onUseIssue(issue)} disabled={busy}>
              {translate('itsaplan.workspace.create', 'Create workspace')}
            </Button>
            {onAttachIssue ? (
              <Button
                variant="outline"
                onClick={() => setAttaching((value) => !value)}
                disabled={busy || workspaces.length === 0}
              >
                {translate('itsaplan.workspace.attach', 'Attach to workspace')}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setEditing(true)} disabled={busy || !canEdit}>
              {translate('itsaplan.issue.edit', 'Edit issue')}
            </Button>
          </div>
        ) : null}
      </div>
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {translate('itsaplan.issue.loading', 'Loading issue…')}
        </p>
      ) : null}
      {error && !editing ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          {!issue ? (
            <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
              {translate('itsaplan.retry', 'Retry')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {issue && editing ? (
        <ItsaplanIssueForm
          issue={issue}
          metadata={metadata}
          busy={busy}
          error={error}
          onSubmit={save}
          onCancel={() => {
            setEditing(false)
            setError(null)
          }}
        />
      ) : issue ? (
        <>
          <div>
            <p className="text-xs text-muted-foreground">{issue.identifier}</p>
            <h2 className="mt-1 text-lg font-medium">{issue.title}</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {metadata.columns.find((column) => column.id === issue.columnId)?.name} ·{' '}
              {issue.priority ?? translate('itsaplan.priority.none', 'No priority')} ·{' '}
              {metadata.assignees.find((member) => member.userId === issue.assigneeUserId)?.name ??
                translate('itsaplan.assignee.none', 'Unassigned')}
            </p>
          </div>
          {attaching && onAttachIssue ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (workspaceId) {
                  void mutate(async () => {
                    await onAttachIssue(issue, workspaceId)
                    if (alive.current) {
                      setAttaching(false)
                    }
                  })
                }
              }}
            >
              <div className="min-w-0 flex-1">
                <ItsaplanSelect
                  label={translate('itsaplan.workspace.choose', 'Workspace')}
                  value={workspaceId}
                  options={workspaces.map((workspace) => ({
                    value: workspace.id,
                    label: workspace.label
                  }))}
                  onChange={setWorkspaceId}
                  disabled={busy}
                />
              </div>
              <Button type="submit" disabled={busy || !workspaceId}>
                {translate('itsaplan.workspace.attachIssue', 'Attach issue')}
              </Button>
            </form>
          ) : null}
          <CommentMarkdown
            content={
              issue.description || translate('itsaplan.issue.noDescription', 'No description.')
            }
            variant="document"
          />
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-medium">
              {translate('itsaplan.comments.title', 'Comments')}
            </h3>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {translate('itsaplan.comments.empty', 'No comments yet.')}
              </p>
            ) : null}
            {comments.map((entry) => (
              <article key={entry.id} className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {entry.actorName ?? translate('itsaplan.comments.unknown', 'Unknown author')}
                  {entry.replyToId
                    ? ` · ${translate('itsaplan.comments.reply', 'Reply to comment')} #${entry.replyToId}`
                    : ''}{' '}
                  ·{' '}
                  <time dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString(getIntlLocale())}
                  </time>
                </p>
                <CommentMarkdown content={entry.body ?? ''} />
              </article>
            ))}
            {cursor ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void mutate(async () => {
                    const page = await api.listComments(issueId, { cursor, limit: 100 })
                    if (alive.current) {
                      setComments((previous) => [
                        ...previous,
                        ...page.items.filter(
                          (entry) => !previous.some((existing) => existing.id === entry.id)
                        )
                      ])
                      setCursor(page.nextCursor)
                    }
                  })
                }
              >
                {translate('itsaplan.comments.more', 'Load more comments')}
              </Button>
            ) : null}
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (canEdit && comment.trim()) {
                  void mutate(async () => {
                    const added = await api.addComment(issueId, comment.trim())
                    if (alive.current) {
                      setComments((previous) => [...previous, added])
                      setComment('')
                    }
                  })
                }
              }}
            >
              <Label htmlFor={`${id}-comment`}>
                {translate('itsaplan.comments.comment', 'Comment')}
              </Label>
              <Textarea
                id={`${id}-comment`}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                maxLength={50000}
                disabled={busy || !canEdit}
              />
              <Button type="submit" disabled={busy || !canEdit || !comment.trim()}>
                {translate('itsaplan.comments.add', 'Add comment')}
              </Button>
            </form>
          </div>
        </>
      ) : null}
    </section>
  )
}
