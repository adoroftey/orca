import { useMemo } from 'react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import type {
  ItsaplanApi,
  ItsaplanIssue,
  ItsaplanProjectDetails
} from '../../../../../shared/itsaplan/types'
import { ItsaplanTasks } from './ItsaplanTasks'

const project = { id: 1, key: 'ORCA', ref: 'engineering.ORCA', name: 'Orca integration' }
const connection = {
  connected: true,
  baseUrl: 'https://api.plan.example',
  webBaseUrl: 'https://plan.example'
}
const issues: ItsaplanIssue[] = [
  {
    id: 1,
    projectId: 1,
    sequenceNumber: 1,
    identifier: 'ORCA-1',
    title: "Add It's a Plan to native Tasks",
    description:
      '## Orca native Tasks\n\nConnect a self-hosted instance, review issues and start a linked workspace.\n\n- Preserve the task context\n- Keep the API key on its execution host',
    columnId: 2,
    assigneeUserId: 'member-1',
    priority: 'high',
    createdAt: '2026-11-03T08:00:00Z',
    updatedAt: '2026-11-03T09:00:00Z'
  },
  {
    id: 2,
    projectId: 1,
    sequenceNumber: 2,
    identifier: 'ORCA-2',
    title: 'Verify links after restarting a folder workspace',
    description: 'A folder workspace retains its task link after a restart.',
    columnId: 1,
    assigneeUserId: null,
    priority: null,
    createdAt: '2026-11-03T08:00:00Z',
    updatedAt: '2026-11-03T09:00:00Z'
  }
]
const metadata: ItsaplanProjectDetails = {
  project,
  columns: [
    { id: 1, name: 'To do', stateType: 'unstarted', color: '', position: 0 },
    { id: 2, name: 'In progress', stateType: 'started', color: '', position: 1 }
  ],
  assignees: [{ userId: 'member-1', name: 'Alex', kind: 'member' }]
}

function fixtureApi(connected: boolean): ItsaplanApi {
  return {
    status: async () =>
      connected ? connection : { connected: false, baseUrl: null, webBaseUrl: null },
    connect: async () => connection,
    disconnect: async () => {},
    listProjects: async () => [project],
    getProject: async () => metadata,
    listIssues: async () => issues,
    searchIssues: async (_ref, query) =>
      issues.filter((issue) => issue.title.toLowerCase().includes(query.toLowerCase())),
    getIssue: async (id) => issues.find((issue) => issue.id === id) ?? issues[0],
    createIssue: async (_ref, input) => ({ ...issues[0], ...input, id: 3 }),
    updateIssue: async (id, update) => ({
      ...(issues.find((issue) => issue.id === id) ?? issues[0]),
      ...update
    }),
    listComments: async () => ({
      items: [
        {
          id: 1,
          issueId: 1,
          kind: 'comment',
          replyToId: null,
          actorName: 'Alex',
          body: 'The local API checks pass. Ready to review the workspace flow.',
          createdAt: '2026-11-03T09:00:00Z'
        }
      ],
      nextCursor: null
    }),
    addComment: async (id, body) => ({
      id: 2,
      issueId: id,
      kind: 'comment',
      replyToId: null,
      actorName: 'Alex',
      body,
      createdAt: '2026-11-03T09:00:00Z'
    })
  }
}

function Fixture({ connected = true }: { connected?: boolean }) {
  const api = useMemo(() => fixtureApi(connected), [connected])
  return (
    <div className="flex h-160 flex-col bg-background p-4">
      <ItsaplanTasks
        api={api}
        hostKey={`visual-fixture-${connected}`}
        onUseIssue={() => {}}
        onAttachIssue={async () => {}}
        workspaces={[{ id: 'workspace-1', label: 'orca-integration' }]}
      />
    </div>
  )
}

function waitForElement(frame: HTMLElement, selector: string): Promise<HTMLElement> {
  const present = frame.querySelector<HTMLElement>(selector)
  if (present) {
    return Promise.resolve(present)
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Fixture did not render ${selector}`))
    }, 5_000)
    const observer = new MutationObserver(() => {
      const element = frame.querySelector<HTMLElement>(selector)
      if (element) {
        clearTimeout(timeout)
        observer.disconnect()
        resolve(element)
      }
    })
    observer.observe(frame, { childList: true, subtree: true })
  })
}

export const disconnected = defineFixture({
  width: 1100,
  render: () => <Fixture connected={false} />,
  interact: async (frame) => {
    await waitForElement(frame, 'input[type="password"]')
  }
})
export const connected = defineFixture({
  width: 1100,
  render: () => <Fixture />,
  interact: async (frame) => {
    await waitForElement(frame, 'button[aria-label^="ORCA-1 "]')
  }
})
export const detail = defineFixture({
  width: 1100,
  render: () => <Fixture />,
  interact: async (frame) => {
    const button = await waitForElement(frame, 'button[aria-label^="ORCA-1 "]')
    button.click()
    await waitForElement(frame, 'textarea')
  }
})
export const narrow = defineFixture({ ...connected, width: 390 })
