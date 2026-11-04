import { describe, expect, it } from 'vitest'
import { filterAvailableTaskProviders, normalizeTaskProviderSettings } from './task-providers'
import { normalizeStoredTaskSourceContext, getTaskSourceCacheScope } from './task-source-context'
import { normalizeWorkspaceLinkedItem } from './workspace-linked-item'
import {
  normalizeWorkspaceAttachmentUpdate,
  getWorkspaceAttachments
} from './workspace-attachments'
import { normalizeWorkspaceAttachments } from './workspace-attachment-normalization'
import { FolderWorkspaceLinkedTask } from './rpc-contract/folder-workspace-params'
import { folderWorkspaceToWorktree } from './folder-workspace-worktree'
import { WorkspaceLinkedItemSchema } from './workspace-linked-item-schema'

const source = (baseUrl = 'https://api.plan.example', projectRef = 'team.OPS') => ({
  kind: 'task-source' as const,
  provider: 'itsaplan' as const,
  projectId: 'orca-project',
  hostId: 'local',
  providerIdentity: { provider: 'itsaplan' as const, baseUrl, projectRef }
})
const item = {
  provider: 'itsaplan' as const,
  type: 'issue' as const,
  number: 7,
  identifier: 'OPS-7',
  title: 'Fix retry',
  url: 'https://plan.example/issue/7'
}

describe('Itsaplan persisted workspace references', () => {
  it('retains Itsaplan as a saved source while other account providers are disconnected', () => {
    expect(
      normalizeTaskProviderSettings({
        visibleTaskProviders: ['itsaplan'],
        defaultTaskSource: 'itsaplan'
      })
    ).toEqual({ visibleTaskProviders: ['itsaplan'], defaultTaskSource: 'itsaplan' })
    expect(
      filterAvailableTaskProviders(['itsaplan'], { gitlabInstalled: false, linearConnected: false })
    ).toEqual(['itsaplan'])
  })

  it('normalizes server identity and separates projects and instances in the cache scope', () => {
    const first = normalizeStoredTaskSourceContext(source('https://API.plan.example/'))
    const same = normalizeStoredTaskSourceContext(source())
    const otherServer = normalizeStoredTaskSourceContext(source('https://other.example'))
    const otherProject = normalizeStoredTaskSourceContext(source(undefined, 'other.OPS'))
    expect(first).not.toBeNull()
    expect(same).not.toBeNull()
    expect(first?.providerIdentity).toEqual({
      provider: 'itsaplan',
      baseUrl: 'https://api.plan.example',
      projectRef: 'team.OPS'
    })
    expect(getTaskSourceCacheScope(first!)).toBe(getTaskSourceCacheScope(same!))
    expect(getTaskSourceCacheScope(first!)).not.toBe(getTaskSourceCacheScope(otherServer!))
    expect(getTaskSourceCacheScope(first!)).not.toBe(getTaskSourceCacheScope(otherProject!))
    expect(
      normalizeStoredTaskSourceContext(source('https://name:secret@api.plan.example'))
    ).toBeNull()
  })

  it('accepts the same rich issue through worktree and folder RPC admission after JSON reload', () => {
    const reloaded = JSON.parse(JSON.stringify(item))
    expect(normalizeWorkspaceLinkedItem(reloaded)).toEqual(item)
    expect(WorkspaceLinkedItemSchema.parse(reloaded)).toEqual(item)
    expect(FolderWorkspaceLinkedTask.parse(reloaded)).toEqual(item)
    const context = normalizeStoredTaskSourceContext(source())!
    const metadata = normalizeWorkspaceAttachmentUpdate(
      {},
      { linkedWorkItem: reloaded, linkedTaskSourceContext: context }
    )
    expect(getWorkspaceAttachments(JSON.parse(JSON.stringify(metadata)))).toEqual([
      expect.objectContaining({ ...item, taskSourceContext: context })
    ])
    const folder = folderWorkspaceToWorktree(
      JSON.parse(
        JSON.stringify({
          id: 'one',
          projectGroupId: 'group',
          name: 'Task',
          folderPath: '/work/project',
          linkedTask: item,
          linkedItems: metadata.linkedItems,
          linkedTaskSourceContext: context,
          comment: '',
          isArchived: false,
          isUnread: false,
          isPinned: false,
          sortOrder: 0,
          lastActivityAt: 1,
          createdAt: 1,
          updatedAt: 1
        })
      )
    )
    expect(folder.linkedWorkItem).toEqual(item)
    expect(getWorkspaceAttachments(folder)).toEqual([
      expect.objectContaining({ ...item, taskSourceContext: context })
    ])
  })

  it('keeps equal numeric ids on different API servers and projects separate', () => {
    const attachments = [
      source(),
      source('https://other.example'),
      source(undefined, 'other.OPS')
    ].map((context) => ({ ...item, taskSourceContext: context }))
    const reloaded = normalizeWorkspaceAttachments(JSON.parse(JSON.stringify(attachments)))
    expect(reloaded).toHaveLength(3)
    expect(reloaded.map((value) => value.taskSourceContext?.providerIdentity)).toEqual(
      attachments.map((value) => value.taskSourceContext.providerIdentity)
    )
  })
})
