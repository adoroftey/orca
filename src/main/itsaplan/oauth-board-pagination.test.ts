import { expect, it, vi } from 'vitest'
import { loadOAuthBoard, type Shared } from './oauth-board'

const epoch = Date.parse('2024-01-01T00:00:00.000Z')
type Summary = { id: number; createdAt: string }
function summaries(count: number): Summary[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    createdAt: new Date(epoch + Math.floor(index / 3) * 1000).toISOString()
  })).sort((a, b) => (a.id % 2) - (b.id % 2) || a.id - b.id)
}
function fixture(
  rows: Summary[],
  mode: 'normal' | 'ignore' | 'invalid' | 'duplicate' | 'root-invalid' = 'normal'
) {
  const paths: string[] = []
  const duplicateRanges: { from: string | null; to: string | null }[] = []
  const close = vi.fn(async () => {})
  const execute = async (
    path: string,
    _method?: string,
    _body?: unknown,
    _retry?: boolean,
    shared?: Shared
  ) => {
    if (shared && !shared.client) {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Only close is used by loadOAuthBoard on this fixture client.
      shared.client = { close } as NonNullable<Shared['client']>
    }
    paths.push(path)
    if (path.startsWith('/projects/')) {
      const params = new URL(path, 'https://example.test').searchParams
      const from = params.get('createdFrom')
      const to = params.get('createdTo')
      let selected = rows
        .filter(
          (row) =>
            mode === 'ignore' || ((!from || row.createdAt >= from) && (!to || row.createdAt < to))
        )
        .slice(0, 500)
      if (mode === 'invalid' && (from || to) && selected.length > 0) {
        selected = [{ ...selected[0], createdAt: 'invalid' }, ...selected.slice(1)]
      }
      if (mode === 'root-invalid' && !from && !to) {
        selected = [{ ...selected[0], createdAt: 'invalid' }, ...selected.slice(1)]
      }
      if (
        mode === 'duplicate' &&
        (from || to) &&
        selected.length > 0 &&
        selected.length < 500 &&
        duplicateRanges.length < 2
      ) {
        duplicateRanges.push({ from, to })
        selected = [{ ...selected[0], id: 999999 }, ...selected.slice(1)]
      }
      return { status: 200, data: selected }
    }
    const id = Number(path.split('/').at(-1))
    return {
      status: 200,
      data: {
        id,
        archivedAt: null,
        description: `detail ${id}`,
        links: id === 1 ? [{ id: 99, kind: 'blocks', direction: 'outward', issue: { id: 2 } }] : [],
        subtasks: []
      }
    }
  }
  return { execute, paths, close, duplicateRanges }
}

it.each([500, 1201])(
  'returns every issue and detail from an unsorted %i-issue board',
  async (count) => {
    const rows = summaries(count)
    const f = fixture(rows)
    const result = await loadOAuthBoard('TEAM', f.execute)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The board contract supplies an issues array of hydrated details.
    const data = result.data as {
      issues: { id: number; description: string; links: { issueId: number; relation: string }[] }[]
    }
    expect(data.issues).toHaveLength(count)
    expect(new Set(data.issues.map((issue) => issue.id))).toEqual(
      new Set(rows.map((row) => row.id))
    )
    for (const issue of data.issues) {
      expect(issue.description).toBe(`detail ${issue.id}`)
    }
    expect(data.issues.find((issue) => issue.id === 1)?.links).toEqual([
      { id: 99, issueId: 2, relation: 'blocks' }
    ])
    const lists = f.paths.filter((path) => path.startsWith('/projects/'))
    expect(lists.length).toBeGreaterThan(1)
    expect(
      lists.some((path) => new URL(path, 'https://example.test').searchParams.has('createdFrom'))
    ).toBe(true)
    expect(
      lists.some((path) => new URL(path, 'https://example.test').searchParams.has('createdTo'))
    ).toBe(true)
    expect(lists.length).toBeLessThanOrEqual(128)
    expect(f.close).toHaveBeenCalledOnce()
  }
)

it.each(['ignore', 'invalid'] as const)(
  'fails closed when a bounded response is %s',
  async (mode) => {
    const f = fixture(summaries(1201), mode)
    await expect(loadOAuthBoard('TEAM', f.execute)).rejects.toThrow()
    expect(f.paths.filter((path) => path.startsWith('/projects/')).length).toBeGreaterThan(1)
    expect(f.paths.filter((path) => path.startsWith('/projects/')).length).toBeLessThanOrEqual(128)
    expect(f.paths.every((path) => path.startsWith('/projects/'))).toBe(true)
    expect(f.close).toHaveBeenCalledOnce()
  }
)

it('fails closed for 500 issues in one indivisible millisecond', async () => {
  const rows = summaries(500).map((row) => ({ ...row, createdAt: '2024-01-01T00:00:00.000Z' }))
  const f = fixture(rows)
  await expect(loadOAuthBoard('TEAM', f.execute)).rejects.toThrow()
  expect(f.paths.filter((path) => path.startsWith('/projects/')).length).toBeGreaterThan(1)
  expect(f.paths.filter((path) => path.startsWith('/projects/')).length).toBeLessThanOrEqual(128)
  expect(f.paths.every((path) => path.startsWith('/projects/'))).toBe(true)
  expect(f.close).toHaveBeenCalledOnce()
})

it('rejects an ID repeated in disjoint completed pages before hydration', async () => {
  const f = fixture(summaries(1201), 'duplicate')
  await expect(loadOAuthBoard('TEAM', f.execute)).rejects.toThrow()
  expect(f.duplicateRanges).toHaveLength(2)
  const [first, second] = f.duplicateRanges
  expect(
    (first.to && second.from && first.to <= second.from) ||
      (second.to && first.from && second.to <= first.from)
  ).toBeTruthy()
  expect(f.paths.filter((path) => path.startsWith('/projects/')).length).toBeLessThanOrEqual(128)
  expect(f.paths.every((path) => path.startsWith('/projects/'))).toBe(true)
  expect(f.close).toHaveBeenCalledOnce()
})

it('rejects a malformed root timestamp without hydrating', async () => {
  const f = fixture(summaries(500), 'root-invalid')
  await expect(loadOAuthBoard('TEAM', f.execute)).rejects.toThrow()
  expect(f.paths).toHaveLength(1)
  expect(f.close).toHaveBeenCalledOnce()
})
