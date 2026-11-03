import type {
  ItsaplanConnectionStatus,
  ItsaplanIssue,
  ItsaplanProject
} from '../../../shared/itsaplan/types'
import { normalizeItsaplanBaseUrl } from '../../../shared/itsaplan-source-identity'
import {
  normalizeTaskSourceContext,
  type TaskSourceContext
} from '../../../shared/task-source-context'
import { getWorkspaceAttachments } from '../../../shared/workspace-attachments'
import type { WorkspaceAttachment, Worktree } from '../../../shared/worktree/types'
import { slugifyForWorkspaceName } from '../../../shared/workspace-name'
import type { LinkedWorkItemSummary } from './new-workspace'

type Connection = Pick<ItsaplanConnectionStatus, 'baseUrl' | 'webBaseUrl'>

export function buildItsaplanIssueComposerData(
  issue: ItsaplanIssue,
  project: ItsaplanProject,
  connection: ItsaplanConnectionStatus,
  source: TaskSourceContext
): {
  prefilledName: string
  linkedWorkItem: LinkedWorkItemSummary
  taskSourceContext: TaskSourceContext
} {
  const baseUrl = normalizeItsaplanBaseUrl(connection.baseUrl)
  const webBaseUrl = normalizeItsaplanBaseUrl(connection.webBaseUrl ?? connection.baseUrl)
  if (!baseUrl || !webBaseUrl || !Number.isSafeInteger(issue.id) || issue.id <= 0) {
    throw new Error('Invalid Itsaplan issue source.')
  }
  const url = `${webBaseUrl}/issue/${issue.id}`
  const taskSourceContext = normalizeTaskSourceContext({
    ...source,
    provider: 'itsaplan',
    providerIdentity: { provider: 'itsaplan', baseUrl, projectRef: project.ref }
  })
  if (!taskSourceContext) {
    throw new Error('Invalid Itsaplan task context.')
  }
  return {
    prefilledName: slugifyForWorkspaceName(`${issue.identifier} ${issue.title}`),
    linkedWorkItem: {
      provider: 'itsaplan',
      type: 'issue',
      number: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url,
      linkedContext: {
        provider: 'itsaplan',
        version: 1,
        renderedText: [`${issue.identifier}: ${issue.title}`, url, issue.description]
          .filter(Boolean)
          .join('\n\n')
      }
    },
    taskSourceContext
  }
}

export function buildItsaplanIssueAttachment(
  issue: ItsaplanIssue,
  project: ItsaplanProject,
  connection: ItsaplanConnectionStatus,
  source: TaskSourceContext
): WorkspaceAttachment {
  const { linkedWorkItem, taskSourceContext } = buildItsaplanIssueComposerData(
    issue,
    project,
    connection,
    source
  )
  return {
    provider: 'itsaplan',
    type: 'issue',
    number: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: linkedWorkItem.url,
    taskSourceContext
  }
}

export function findItsaplanIssueWorkspaceAttachment(
  worktrees: readonly Worktree[],
  issue: Pick<ItsaplanIssue, 'id'>,
  project: Pick<ItsaplanProject, 'ref'>,
  connection: Connection,
  source?: Pick<TaskSourceContext, 'hostId'>
): Worktree | null {
  const baseUrl = normalizeItsaplanBaseUrl(connection.baseUrl)
  if (!baseUrl) {
    return null
  }
  return (
    worktrees
      .filter(
        (worktree) =>
          !worktree.isArchived &&
          getWorkspaceAttachments(worktree).some((item) => {
            const identity = item.taskSourceContext?.providerIdentity
            return (
              item.provider === 'itsaplan' &&
              item.type === 'issue' &&
              item.number === issue.id &&
              identity?.provider === 'itsaplan' &&
              normalizeItsaplanBaseUrl(identity.baseUrl) === baseUrl &&
              identity.projectRef === project.ref &&
              (!source || item.taskSourceContext?.hostId === source.hostId)
            )
          })
      )
      .toSorted((a, b) => b.lastActivityAt - a.lastActivityAt)[0] ?? null
  )
}
