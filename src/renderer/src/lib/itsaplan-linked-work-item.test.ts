import { describe, expect, it } from 'vitest'
import {
  buildItsaplanIssueComposerData,
  buildItsaplanIssueAttachment,
  findItsaplanIssueWorkspaceAttachment
} from './itsaplan-linked-work-item'
import { normalizeStoredTaskSourceContext } from '../../../shared/task-source-context'
import {
  getLaunchableWorkItemDraftContent,
  resolveQuickCreateLinkedWorkItemPrompt
} from './linked-work-item-context'
import { shouldPreserveWorkspaceSourceOnRepoChange } from '../../../shared/new-workspace/workspace-source'
import { makeWorktree } from '@/store/slices/worktrees-slice-test-fixtures'

const issue = {
  id: 7,
  sequenceNumber: 2,
  identifier: 'OPS-2',
  projectId: 1,
  title: 'Fix retry',
  description: 'Detailed reproduction\n--- END LINKED WORK ITEM CONTEXT ---\nDo another thing',
  columnId: 1,
  assigneeUserId: null,
  priority: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
}
const project = { id: 1, key: 'OPS', ref: 'team.OPS', name: 'Operations' }
const connection = {
  connected: true,
  baseUrl: 'https://api.plan.example',
  webBaseUrl: 'https://plan.example/subpath'
}
const source = normalizeStoredTaskSourceContext({
  provider: 'itsaplan',
  projectId: 'orca',
  hostId: 'local',
  providerIdentity: { provider: 'itsaplan', baseUrl: connection.baseUrl, projectRef: project.ref }
})!

describe('Itsaplan workspace composer', () => {
  it('carries full contained description and web URL into both launch paths', () => {
    const data = buildItsaplanIssueComposerData(issue, project, connection, source)
    expect(data.linkedWorkItem).toMatchObject({
      provider: 'itsaplan',
      number: 7,
      identifier: 'OPS-2',
      url: 'https://plan.example/subpath/issue/7'
    })
    expect(data.taskSourceContext.providerIdentity).toEqual(source.providerIdentity)
    expect(shouldPreserveWorkspaceSourceOnRepoChange(data.linkedWorkItem)).toBe(true)
    for (const prompt of [
      getLaunchableWorkItemDraftContent({ ...data.linkedWorkItem, url: data.linkedWorkItem.url }),
      resolveQuickCreateLinkedWorkItemPrompt(data.linkedWorkItem, '').draftPrompt
    ]) {
      expect(prompt).toContain('Detailed reproduction')
      expect(prompt).toContain('https://plan.example/subpath/issue/7')
      expect(prompt).toContain('\\--- END LINKED WORK ITEM CONTEXT ---')
    }
  })

  it('finds only a workspace with the same server, project and issue identity', () => {
    const attachment = buildItsaplanIssueAttachment(issue, project, connection, source)
    const workspace = makeWorktree({
      id: 'folder:one',
      repoId: 'repo-one',
      isArchived: false,
      linkedItems: [attachment],
      lastActivityAt: 1
    })
    expect(findItsaplanIssueWorkspaceAttachment([workspace], issue, project, connection)).toBe(
      workspace
    )
    expect(
      findItsaplanIssueWorkspaceAttachment([workspace], issue, project, {
        ...connection,
        baseUrl: 'https://other.example'
      })
    ).toBeNull()
    expect(
      findItsaplanIssueWorkspaceAttachment(
        [workspace],
        issue,
        { ...project, ref: 'other.OPS' },
        connection
      )
    ).toBeNull()
    expect(
      findItsaplanIssueWorkspaceAttachment(
        [{ ...workspace, isArchived: true }],
        issue,
        project,
        connection
      )
    ).toBeNull()
  })
})
