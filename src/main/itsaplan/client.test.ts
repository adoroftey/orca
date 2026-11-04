import { describe, expect, it, vi } from 'vitest'
import { createItsaplanClient } from './client'

const apiKey = 'itsaplan-test-secret-do-not-leak'

function issueFixture() {
  return {
    id: 42,
    projectId: 7,
    sequenceNumber: 3,
    identifier: 'API-3',
    title: 'Retain queued work',
    description: 'The queue must survive a restart.',
    columnId: 11,
    assigneeUserId: 'user-1',
    priority: 'high',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-03T08:00:00Z'
  }
}

function clientWithResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }))
  const client = createItsaplanClient({
    baseUrl: 'https://api.plan.example/planner/',
    apiKey,
    fetch: fetchMock
  })
  return { client, fetchMock }
}

describe('Itsaplan REST client', () => {
  it('reads projects from the configured API subpath with its REST API key header and no redirects', async () => {
    const projects = [{ id: 7, key: 'API', ref: 'engineering.API', name: 'API' }]
    const { client, fetchMock } = clientWithResponse(projects)

    await expect(client.listProjects()).resolves.toEqual(projects)

    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe('https://api.plan.example/planner/projects')
    expect(new Headers(init?.headers).get('x-api-key')).toBe(apiKey)
    expect(new Headers(init?.headers).get('Authorization')).toBeNull()
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
    expect(init?.redirect).toBe('error')
  })

  it('supports an explicitly configured local HTTP instance', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]))
    const client = createItsaplanClient({
      baseUrl: 'http://127.0.0.1:3000',
      apiKey,
      fetch: fetchMock
    })

    await client.listProjects()

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:3000/projects')
  })

  it.each([
    'file:///etc/passwd',
    'ftp://plan.example',
    'https://user:password@plan.example',
    'https://plan.example?token=secret',
    'https://plan.example#private',
    'not-a-url'
  ])('rejects unsafe server configuration before a request: %s', (baseUrl) => {
    const fetchMock = vi.fn<typeof fetch>()

    expect(() => createItsaplanClient({ baseUrl, apiKey, fetch: fetchMock })).toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps a project reference inside a single path segment', async () => {
    const details = {
      project: { id: 7, key: 'API', ref: 'team.API', name: 'API' },
      columns: [],
      assignees: []
    }
    const { client, fetchMock } = clientWithResponse(details)

    await expect(client.getProject('team.API/../../other?x=1')).resolves.toEqual(details)

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.plan.example/planner/projects/team.API%2F..%2F..%2Fother%3Fx%3D1'
    )
  })

  it('reads every active board issue without inventing unsupported offset pagination', async () => {
    const issues = Array.from({ length: 501 }, (_, index) => ({
      ...issueFixture(),
      id: index + 1,
      identifier: `API-${index + 1}`,
      description: ''
    }))
    const { client, fetchMock } = clientWithResponse({ issues })

    await expect(client.listIssues('engineering.API')).resolves.toEqual(issues)

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://api.plan.example/planner/projects/engineering.API/issues/board'
    )
  })

  it('uses the text search endpoint and preserves archived search hits', async () => {
    const hits = [{ ...issueFixture(), archived: true }]
    const { client, fetchMock } = clientWithResponse(hits)

    await expect(client.searchIssues('engineering.API', 'queue & retry', 250)).resolves.toEqual(
      hits
    )

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/planner/projects/engineering.API/issues/search')
    expect(url.searchParams.get('q')).toBe('queue & retry')
    expect(url.searchParams.get('limit')).toBe('250')
  })

  it('loads the full description by numeric issue id', async () => {
    const issue = issueFixture()
    const { client, fetchMock } = clientWithResponse(issue)

    await expect(client.getIssue(42)).resolves.toEqual(issue)

    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.plan.example/planner/issues/42')
  })

  it('creates issues in the project with a string priority and member user id', async () => {
    const issue = issueFixture()
    const { client, fetchMock } = clientWithResponse(issue, 201)
    const input = {
      title: issue.title,
      description: issue.description,
      columnId: 11,
      assigneeUserId: 'user-1',
      priority: 'high'
    }

    await expect(client.createIssue('engineering.API', input)).resolves.toEqual(issue)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.plan.example/planner/projects/engineering.API/issues')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(input)
    expect(new Headers(init?.headers).get('Content-Type')).toContain('application/json')
  })

  it('clears assignment and priority with explicit null values on PATCH', async () => {
    const updated = { ...issueFixture(), assigneeUserId: null, priority: null, columnId: 12 }
    const { client, fetchMock } = clientWithResponse(updated)
    const patch = { assigneeUserId: null, priority: null, columnId: 12 }

    await expect(client.updateIssue(42, patch)).resolves.toEqual(updated)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.plan.example/planner/issues/42')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual(patch)
  })

  it('preserves comment keyset cursors and replies across pages', async () => {
    const cursor = { ts: '2026-11-03T09:00:00Z', id: 22 }
    const nextCursor = { ts: '2026-11-03T10:00:00Z', id: 25 }
    const reply = {
      id: 25,
      issueId: 42,
      kind: 'comment',
      replyToId: 21,
      actorName: 'Ada',
      body: 'Keep the original task context.',
      createdAt: '2026-11-03T10:00:00Z'
    }
    const { client, fetchMock } = clientWithResponse({ items: [reply], nextCursor })

    await expect(client.listComments(42, { cursor, limit: 30 })).resolves.toEqual({
      items: [reply],
      nextCursor
    })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/planner/issues/42/feed')
    expect(url.searchParams.get('filter')).toBe('comments')
    expect(url.searchParams.get('order')).toBe('asc')
    expect(url.searchParams.get('limit')).toBe('30')
    expect(JSON.parse(url.searchParams.get('cursor') ?? '')).toEqual(cursor)
  })

  it('adds a comment using the issue comment resource', async () => {
    const comment = {
      id: 31,
      issueId: 42,
      kind: 'comment',
      replyToId: null,
      actorName: 'Ada',
      body: 'Ready for review.',
      createdAt: '2026-11-03T10:00:00Z'
    }
    const { client, fetchMock } = clientWithResponse(comment, 201)

    await expect(client.addComment(42, comment.body)).resolves.toEqual(comment)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.plan.example/planner/issues/42/comments')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ body: comment.body })
  })

  it('does not expose an upstream response body containing the API key', async () => {
    const { client } = clientWithResponse(
      { message: `Rejected Authorization: Bearer ${apiKey}` },
      401
    )

    const error: unknown = await client.listProjects().catch((error: unknown) => error)

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) {
      throw new Error('Expected an Itsaplan request error.')
    }
    expect(error.message).not.toContain(apiKey)
  })

  it('does not expose transport errors containing the API key', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error(`Connection failed ${apiKey}`))
    const client = createItsaplanClient({
      baseUrl: 'https://api.plan.example',
      apiKey,
      fetch: fetchMock
    })

    const error: unknown = await client.listProjects().catch((error: unknown) => error)

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) {
      throw new Error('Expected an Itsaplan request error.')
    }
    expect(error.message).not.toContain(apiKey)
  })
})
