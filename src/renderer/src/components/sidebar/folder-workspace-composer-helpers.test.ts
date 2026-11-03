import { describe, expect, it } from 'vitest'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import {
  getFolderSourceRepos,
  toFolderWorkspaceLinkedTask
} from './folder-workspace-composer-helpers'
import { buildItsaplanIssueComposerData } from '@/lib/itsaplan-linked-work-item'
import { resolveQuickCreateLinkedWorkItemPrompt } from '@/lib/linked-work-item-context'
import {
  normalizeWorkspaceAttachmentUpdate,
  getWorkspaceAttachments
} from '../../../../shared/workspace-attachments'
import { normalizeWorkspaceLinkedItem } from '../../../../shared/workspace-linked-item'
import { folderWorkspaceToWorktree } from '../../../../shared/folder-workspace-worktree'
import type { TaskSourceContext } from '../../../../shared/task-source-context'

function repo(id: string, overrides: Partial<Repo> = {}): Repo {
  return {
    id,
    path: '/srv/app',
    displayName: id,
    badgeColor: '#111111',
    addedAt: 1,
    kind: 'git',
    ...overrides
  }
}

function group(overrides: Partial<ProjectGroup> = {}): ProjectGroup {
  return {
    id: 'group-ssh-a',
    name: 'Remote App',
    parentPath: '/srv',
    connectionId: 'ssh-a',
    parentGroupId: null,
    createdFrom: 'folder-scan',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('getFolderSourceRepos', () => {
  it('only returns source repos from the same execution host as the folder group', () => {
    const projectGroup = group()
    const localSamePath = repo('local-same-path', { connectionId: null })
    const otherSshSamePath = repo('ssh-b-same-path', { connectionId: 'ssh-b' })
    const matchingSshByPath = repo('ssh-a-by-path', { connectionId: 'ssh-a' })
    const matchingSshByGroup = repo('ssh-a-by-group', {
      path: '/other/path',
      connectionId: 'ssh-a',
      projectGroupId: projectGroup.id
    })

    expect(
      getFolderSourceRepos(
        [localSamePath, otherSshSamePath, matchingSshByPath, matchingSshByGroup],
        [projectGroup],
        projectGroup
      ).map((item) => item.id)
    ).toEqual(['ssh-a-by-path', 'ssh-a-by-group'])
  })

  it('returns runtime source repos for runtime-owned folder groups', () => {
    const projectGroup = group({ connectionId: null, executionHostId: 'runtime:env-1' })
    const localSamePath = repo('local-same-path', { connectionId: null, executionHostId: 'local' })
    const runtimeByPath = repo('runtime-by-path', {
      connectionId: null,
      executionHostId: 'runtime:env-1'
    })
    const runtimeByGroup = repo('runtime-by-group', {
      path: '/other/path',
      connectionId: null,
      executionHostId: 'runtime:env-1',
      projectGroupId: projectGroup.id
    })

    expect(
      getFolderSourceRepos(
        [localSamePath, runtimeByPath, runtimeByGroup],
        [projectGroup],
        projectGroup
      ).map((item) => item.id)
    ).toEqual(['runtime-by-path', 'runtime-by-group'])
  })
})

describe('Itsaplan composer conversion', () => {
  it('retains the native issue key through Git and folder workspace persistence', () => {
    const source: TaskSourceContext = {
      kind: 'task-source',
      provider: 'itsaplan',
      projectId: 'orca',
      hostId: 'local',
      providerIdentity: {
        provider: 'itsaplan',
        baseUrl: 'https://api.plan.example',
        projectRef: 'team.ORCA'
      }
    }
    const data = buildItsaplanIssueComposerData(
      {
        id: 42,
        sequenceNumber: 7,
        identifier: 'ORCA-7',
        projectId: 1,
        title: 'Keep task context',
        description: 'The full issue description.',
        columnId: 1,
        assigneeUserId: null,
        priority: 'high',
        createdAt: '2026-11-03',
        updatedAt: '2026-11-03'
      },
      { id: 1, key: 'ORCA', ref: 'team.ORCA', name: 'Orca' },
      {
        connected: true,
        baseUrl: 'https://api.plan.example',
        webBaseUrl: 'https://plan.example'
      },
      source
    )
    const linkedTask = toFolderWorkspaceLinkedTask(data.linkedWorkItem)
    const reloaded = JSON.parse(JSON.stringify(linkedTask))
    const linkedWorkItem = normalizeWorkspaceLinkedItem(reloaded)
    expect(linkedWorkItem).toMatchObject({ provider: 'itsaplan', number: 42, identifier: 'ORCA-7' })
    const metadata = normalizeWorkspaceAttachmentUpdate(
      {},
      {
        linkedWorkItem,
        linkedTaskSourceContext: data.taskSourceContext
      }
    )
    expect(getWorkspaceAttachments(metadata)).toEqual([
      expect.objectContaining({ identifier: 'ORCA-7', taskSourceContext: data.taskSourceContext })
    ])
    const folder = folderWorkspaceToWorktree({
      id: 'folder',
      projectGroupId: 'group',
      name: 'Task',
      folderPath: '/work/task',
      linkedTask: reloaded,
      linkedItems: metadata.linkedItems,
      linkedTaskSourceContext: data.taskSourceContext,
      comment: '',
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 1,
      createdAt: 1,
      updatedAt: 1
    })
    expect(folder.linkedWorkItem?.identifier).toBe('ORCA-7')
    expect(getWorkspaceAttachments(folder)[0].taskSourceContext?.providerIdentity).toEqual(
      source.providerIdentity
    )
    expect(resolveQuickCreateLinkedWorkItemPrompt(data.linkedWorkItem, '').draftPrompt).toContain(
      'The full issue description.'
    )
  })
})
