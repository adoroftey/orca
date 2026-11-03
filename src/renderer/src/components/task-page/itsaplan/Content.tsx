import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import type { TaskPageComposerActionsModel } from '../use-task-page-composer-actions'
import type {
  ItsaplanConnectionStatus,
  ItsaplanIssue,
  ItsaplanProject
} from '../../../../../shared/itsaplan/types'
import { normalizeTaskSourceContext } from '../../../../../shared/task-source-context'
import { getWorkspaceAttachments } from '../../../../../shared/workspace-attachments'
import { createItsaplanRuntimeClient } from '@/runtime/runtime-itsaplan-client'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import {
  buildItsaplanIssueAttachment,
  buildItsaplanIssueComposerData,
  findItsaplanIssueWorkspaceAttachment
} from '@/lib/itsaplan-linked-work-item'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { ItsaplanTasks } from './ItsaplanTasks'
import { itsaplanErrorMessage } from './request-state'

export function TaskPageItsaplanContent({ model }: { model: TaskPageComposerActionsModel }) {
  const {
    providerRuntimeContextKey,
    accountBackedTaskSourceHostId,
    fallbackTaskSourceProjectId,
    openModal
  } = model
  const transport = useMemo(() => {
    const hostKey = `${accountBackedTaskSourceHostId}:${providerRuntimeContextKey}`
    try {
      const target = ipcOrRuntimeTargetForHostId(accountBackedTaskSourceHostId)
      if (!target) {
        throw new Error(translate('itsaplan.workspace.noSource', 'The task source is unavailable.'))
      }
      return {
        api: createItsaplanRuntimeClient(target),
        error: null,
        hostKey
      }
    } catch (failure) {
      return { api: null, error: itsaplanErrorMessage(failure), hostKey }
    }
  }, [accountBackedTaskSourceHostId, providerRuntimeContextKey])
  const worktrees = useAppStore(useShallow((state) => state.allWorktrees()))
  const eligibleWorktrees = worktrees.filter(
    (workspace) => (workspace.hostId ?? 'local') === accountBackedTaskSourceHostId
  )
  function sourceFor(project: ItsaplanProject, connection: ItsaplanConnectionStatus) {
    return normalizeTaskSourceContext({
      provider: 'itsaplan',
      projectId: fallbackTaskSourceProjectId,
      hostId: accountBackedTaskSourceHostId,
      providerIdentity: {
        provider: 'itsaplan',
        baseUrl: connection.baseUrl,
        projectRef: project.ref
      }
    })
  }
  function openComposer(
    issue: ItsaplanIssue,
    project: ItsaplanProject,
    connection: ItsaplanConnectionStatus
  ) {
    const source = sourceFor(project, connection)
    if (!source) {
      toast.error(translate('itsaplan.workspace.noSource', 'The task source is unavailable.'))
      return
    }
    openModal('new-workspace-composer', {
      ...buildItsaplanIssueComposerData(issue, project, connection, source),
      telemetrySource: 'sidebar'
    })
  }
  if (!transport.api) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {transport.error}
      </p>
    )
  }
  return (
    <ItsaplanTasks
      api={transport.api}
      hostKey={transport.hostKey}
      workspaces={eligibleWorktrees.map((workspace) => ({
        id: workspace.id,
        label: workspace.displayName
      }))}
      onUseIssue={openComposer}
      linkedWorkspaceName={(issue, project, connection) =>
        findItsaplanIssueWorkspaceAttachment(worktrees, issue, project, connection, {
          hostId: accountBackedTaskSourceHostId
        })?.displayName ?? null
      }
      onOpenIssue={(issue, project, connection) => {
        const workspace = findItsaplanIssueWorkspaceAttachment(
          useAppStore.getState().allWorktrees(),
          issue,
          project,
          connection,
          { hostId: accountBackedTaskSourceHostId }
        )
        if (
          !workspace ||
          activateAndRevealWorktree(workspace.id, { navigationIntent: 'user-open' }) === false
        ) {
          toast.error(
            translate('itsaplan.workspace.openFailed', 'Unable to open the linked workspace.')
          )
        }
      }}
      onAttachIssue={async (issue, project, connection, workspaceId) => {
        const source = sourceFor(project, connection)
        const store = useAppStore.getState()
        const workspace = store
          .allWorktrees()
          .find(
            (entry) =>
              entry.id === workspaceId &&
              (entry.hostId ?? 'local') === accountBackedTaskSourceHostId
          )
        if (!workspace || !source) {
          throw new Error(
            translate('itsaplan.workspace.noTarget', 'The selected workspace is unavailable.')
          )
        }
        const existing = getWorkspaceAttachments(workspace)
        const attachment = buildItsaplanIssueAttachment(issue, project, connection, source)
        const result = await store.updateWorktreeMeta(
          workspace.id,
          { linkedItems: [...existing, attachment] },
          { executionHostId: workspace.hostId ?? accountBackedTaskSourceHostId }
        )
        if (!result.ok) {
          throw new Error(
            result.error ??
              translate('itsaplan.workspace.attachFailed', 'Unable to attach this issue.')
          )
        }
      }}
    />
  )
}
