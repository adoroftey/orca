import { describe, expect, it, vi } from 'vitest'
import { createItsaplanClient } from './client'

const key = 'test-planning-secret'
const view = {
  id: 3,
  projectId: 7,
  name: 'Roadmap',
  icon: null,
  filters: { future: { op: 'new' } },
  display: { layout: 'board', extra: [1, 2] },
  position: 1,
  createdAt: '2026-11-03T00:00:00Z',
  futureField: { enabled: true }
}
const dashboard = {
  id: 4,
  projectId: 7,
  name: 'Overview',
  icon: null,
  layout: [{ type: 'future', config: { x: 1 } }],
  position: 0,
  createdAt: '2026-11-03T00:00:00Z',
  futureField: ['keep']
}
function setup(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response)
  const api = createItsaplanClient({
    baseUrl: 'https://plan.example/root/',
    apiKey: key,
    fetch: fetchMock
  })
  return { planning: api.planning!, fetchMock }
}

describe('planning REST contract', () => {
  it('uses page and pageSize and preserves the page envelope', async () => {
    const page = { items: [], total: 23, page: 2, pageSize: 7 }
    const { planning, fetchMock } = setup(Response.json(page))
    await expect(planning.listInitiatives('team/A', { page: 2, pageSize: 7 })).resolves.toEqual(
      page
    )
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/root/projects/team%2FA/initiatives')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('pageSize')).toBe('7')
    expect(url.searchParams.has('offset')).toBe(false)
    expect(url.searchParams.has('limit')).toBe(false)
    const init = fetchMock.mock.calls[0][1]
    expect(new Headers(init?.headers).get('x-api-key')).toBe(key)
    expect(init?.redirect).toBe('error')
  })
  it('serializes feed cursors as JSON and retains the next cursor', async () => {
    const cursor = { ts: '2026-11-03T00:00:00Z', id: 13 }
    const page = { items: [], nextCursor: cursor }
    const { planning, fetchMock } = setup(Response.json(page))
    await expect(planning.initiativeFeed(8, { cursor, limit: 5 })).resolves.toEqual(page)
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/root/initiatives/8/feed')
    expect(JSON.parse(url.searchParams.get('cursor')!)).toEqual(cursor)
    expect(url.searchParams.get('limit')).toBe('5')
  })
  it('round-trips unknown view JSON and sends only the partial update', async () => {
    const { planning, fetchMock } = setup(Response.json(view))
    const patch = { filters: view.filters, display: view.display }
    await expect(planning.updateView(3, patch)).resolves.toEqual(view)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://plan.example/root/views/3')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual(patch)
    expect(JSON.parse(String(init?.body))).not.toHaveProperty('isPrivate')
  })
  it('returns only a valid account timezone and retains flags when preferences fail', async () => {
    const { planning, fetchMock } = setup(Response.json({ paths: { '/views/{id}/hidden': {} } }))
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith('/account/preferences')
        ? Response.json({ timezone: 'Europe/Nicosia', email: 'private@example.test' })
        : Response.json({ paths: { '/views/{id}/hidden': {} } })
    )
    await expect(planning.capabilities()).resolves.toEqual({
      privateViews: false,
      hiddenViews: true,
      publishViews: false,
      tabOrder: false,
      favorites: false,
      timeZone: 'Europe/Nicosia'
    })
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith('/account/preferences')
        ? new Response(null, { status: 500 })
        : Response.json({ paths: { '/views/{id}/hidden': {} } })
    )
    await expect(planning.capabilities()).resolves.toEqual({
      privateViews: false,
      hiddenViews: true,
      publishViews: false,
      tabOrder: false,
      favorites: false
    })
  })
  it('refuses private creation before POST when the server does not support it', async () => {
    const docs = {
      paths: {
        '/projects/{ref}/views': {
          post: {
            requestBody: {
              content: { 'application/json': { schema: { properties: { name: {} } } } }
            }
          }
        }
      }
    }
    const responseOnly = {
      ...docs,
      components: { schemas: { View: { properties: { isPrivate: {} } } } }
    }
    const { planning, fetchMock } = setup(Response.json(responseOnly))
    await expect(planning.capabilities()).resolves.toMatchObject({ privateViews: false })
    fetchMock.mockResolvedValue(Response.json(responseOnly))
    await expect(planning.createView('team', { name: 'Private', isPrivate: true })).rejects.toThrow(
      /private view.*unsupported/i
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[0][1]?.method ?? 'GET').toBe('GET')
  })
  it('creates private views when the server supports them', async () => {
    const docs = {
      paths: {
        '/projects/{ref}/views': {
          post: {
            requestBody: {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CreateView' } }
              }
            }
          }
        }
      }
    }
    const supportedDocs = {
      ...docs,
      components: { schemas: { CreateView: { properties: { isPrivate: {} } } } }
    }
    const privateView = { ...view, isPrivate: true }
    const { planning, fetchMock } = setup(Response.json(docs))
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'POST') {
        return Response.json(privateView)
      }
      if (String(url).endsWith('/account/preferences')) {
        return Response.json({ timezone: '' })
      }
      return Response.json(supportedDocs)
    })
    await expect(planning.capabilities()).resolves.toMatchObject({ privateViews: true })
    await expect(
      planning.createView('team', { name: 'Private', isPrivate: true })
    ).resolves.toEqual(privateView)
    expect(fetchMock.mock.calls[4][1]?.method).toBe('POST')
    expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body))).toEqual({
      name: 'Private',
      isPrivate: true
    })
  })
  it('preserves arbitrary fields when reading views and dashboards', async () => {
    const views = setup(Response.json([view]))
    await expect(views.planning.listViews('team')).resolves.toEqual([view])
    const dashboards = setup(Response.json([dashboard]))
    await expect(dashboards.planning.listDashboards('team')).resolves.toEqual([dashboard])
  })
  it.each(['deleteInitiative', 'deleteView', 'deleteDashboard'] as const)(
    '%s accepts an empty 204 response',
    async (method) => {
      const { planning, fetchMock } = setup(new Response(null, { status: 204 }))
      await expect(planning[method](8)).resolves.toBeUndefined()
      expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE')
    }
  )
  it('rejects an empty 204 when listing views requires an array', async () => {
    const { planning } = setup(new Response(null, { status: 204 }))
    await expect(planning.listViews('team')).rejects.toThrow(
      'Itsaplan returned an invalid or oversized response.'
    )
  })
  it('does not expose credentials from an upstream error', async () => {
    const { planning } = setup(Response.json({ message: `Denied ${key}` }, { status: 401 }))
    const error = await planning.listViews('team').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) {
      throw new Error('Expected an error')
    }
    expect(error.message).not.toContain(key)
  })
})
