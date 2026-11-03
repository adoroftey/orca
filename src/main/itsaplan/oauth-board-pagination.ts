type Range = { from?: number; to?: number }
type Summary = { id: number; createdAt?: unknown }

const unavailable =
  'This server OAuth issue list is limited to 500; a complete board is unavailable.'

function isSummary(value: unknown): value is Summary {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('id' in value)) {
    return false
  }
  return typeof value.id === 'number' && Number.isSafeInteger(value.id) && value.id > 0
}

function timestamp(value: unknown): number {
  if (typeof value !== 'string') {
    throw new Error(unavailable)
  }
  const parts =
    /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:Z|([+-])(\d\d):(\d\d))$/.exec(value)
  if (!parts) {
    throw new Error(unavailable)
  }
  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  const hour = Number(parts[4])
  const minute = Number(parts[5])
  const second = Number(parts[6])
  const offsetHour = Number(parts[8] ?? 0)
  const offsetMinute = Number(parts[9] ?? 0)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    throw new Error(unavailable)
  }
  const result = Date.parse(value)
  if (!Number.isFinite(result)) {
    throw new Error(unavailable)
  }
  return result
}

export async function enumerateBoardSummaries(
  readPage: (range: Range) => Promise<unknown[]>
): Promise<Summary[]> {
  let calls = 0
  const accepted: Summary[] = []
  const acceptedIds = new Set<number>()

  async function visit(range: Range, depth: number): Promise<void> {
    if (depth > 64 || calls >= 128) {
      throw new Error(`${unavailable} Enumeration resource limit reached.`)
    }
    calls++
    const page = await readPage(range)
    if (page.length > 500) {
      throw new Error('Invalid Itsaplan board response.')
    }
    const pageIds = new Set<number>()
    let min = Infinity
    let max = -Infinity
    for (const row of page) {
      if (!isSummary(row) || pageIds.has(row.id)) {
        throw new Error('Invalid Itsaplan board response.')
      }
      pageIds.add(row.id)
      if (page.length === 500 || range.from !== undefined || range.to !== undefined) {
        const time = timestamp(row.createdAt)
        if (
          (range.from !== undefined && time < range.from) ||
          (range.to !== undefined && time >= range.to)
        ) {
          throw new Error(`${unavailable} Creation time filter was not respected.`)
        }
        min = Math.min(min, time)
        max = Math.max(max, time)
      }
    }
    if (page.length < 500) {
      if (accepted.length + page.length > 10000) {
        throw new Error(`${unavailable} Enumeration resource limit reached.`)
      }
      for (const row of page) {
        if (!isSummary(row) || acceptedIds.has(row.id)) {
          throw new Error('Invalid Itsaplan board response: duplicate issue ID.')
        }
        acceptedIds.add(row.id)
        accepted.push(row)
      }
      return
    }
    let pivot: number
    if (min < max) {
      pivot = min + Math.ceil((max - min) / 2)
    } else if (
      (range.from === undefined || min > range.from) &&
      (range.to === undefined || min < range.to)
    ) {
      pivot = min
    } else if ((range.to === undefined || min + 1 < range.to) && min + 1 <= 8640000000000000) {
      pivot = min + 1
    } else if (range.from !== undefined && range.to !== undefined && range.to - range.from > 1) {
      pivot = range.from + Math.floor((range.to - range.from) / 2)
    } else {
      throw new Error(`${unavailable} Dense creation time bucket cannot be enumerated.`)
    }
    const leafStart = accepted.length
    await visit({ from: range.from, to: pivot }, depth + 1)
    await visit({ from: pivot, to: range.to }, depth + 1)
    const descendantIds = new Set(accepted.slice(leafStart).map((row) => row.id))
    for (const id of pageIds) {
      if (!descendantIds.has(id)) {
        throw new Error(`${unavailable} Creation time filters omitted known issues.`)
      }
    }
  }

  await visit({}, 0)
  return accepted
}
