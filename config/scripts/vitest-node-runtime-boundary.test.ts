import { globSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import ts from 'typescript-api'
import { expect, it } from 'vitest'
import { discoverUnitFiles } from './ci-unit-files.mjs'
import { getNodeRuntimeInclude } from './vitest-node-runtime-files.mjs'

it('runs Node runtime contracts in Node even when the coordinator uses Bun', () => {
  expect(process.versions.bun).toBeUndefined()
  expect(process.release.name).toBe('node')
  expect(Number(process.versions.node.split('.')[0])).toBeGreaterThanOrEqual(24)
})

function isGlobalThis(expression: ts.Expression): boolean {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return isGlobalThis(expression.expression)
  }
  return ts.isIdentifier(expression) && expression.text === 'globalThis'
}

async function findGcRuntimeViolations(
  root: string,
  files: string[],
  nodeFiles: Set<string>
): Promise<string[]> {
  const candidates = files.filter((file) => !nodeFiles.has(resolve(root, file)))
  const sources = Array.from<string>({ length: candidates.length })
  let next = 0
  const workers = Array.from({ length: Math.min(16, candidates.length) }, async () => {
    while (next < candidates.length) {
      const index = next++
      sources[index] = await readFile(resolve(root, candidates[index]), 'utf8')
    }
  })
  const results = await Promise.allSettled(workers)
  const failure = results.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') {
    throw failure.reason
  }

  const missing: string[] = []
  for (const [index, file] of candidates.entries()) {
    const source = sources[index]
    if (!source.includes('heapUsed') || !source.includes('gc')) {
      continue
    }
    const module = ts.createSourceFile(file, source, ts.ScriptTarget.Latest)
    let usesGlobalGc = false
    const visit = (node: ts.Node): void => {
      if (
        (ts.isPropertyAccessExpression(node) &&
          node.name.text === 'gc' &&
          isGlobalThis(node.expression)) ||
        (ts.isElementAccessExpression(node) &&
          ts.isStringLiteral(node.argumentExpression) &&
          node.argumentExpression.text === 'gc' &&
          isGlobalThis(node.expression))
      ) {
        usesGlobalGc = true
      }
      ts.forEachChild(node, visit)
    }
    visit(module)
    if (usesGlobalGc) {
      missing.push(file)
    }
  }
  return missing
}

it('keeps exposed-GC heap measurements in the Node runtime project', async () => {
  const root = process.cwd()
  const nodeFiles = new Set(globSync(getNodeRuntimeInclude()).map((file) => resolve(root, file)))
  expect(await findGcRuntimeViolations(root, discoverUnitFiles(root), nodeFiles)).toEqual([])
})

it('routes the real Claude SDK child-process contract to Node', () => {
  expect(getNodeRuntimeInclude()).toContain(
    'src/main/runtime/structured-claude-thinking-display-refusal.test.ts'
  )
})

it('identifies uncovered global GC calls in source order and propagates read failures', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'gc-census-'))
  try {
    const files = ['first.ts', 'node.ts', 'mention.ts', 'wrapped.ts', 'last.ts']
    await Promise.all([
      writeFile(resolve(root, files[0]), 'globalThis.gc(); heapUsed'),
      writeFile(resolve(root, files[1]), 'globalThis.gc(); heapUsed'),
      writeFile(resolve(root, files[2]), "const message = 'gc heapUsed'"),
      writeFile(resolve(root, files[3]), '(globalThis as typeof globalThis)["gc"](); heapUsed'),
      writeFile(resolve(root, files[4]), '(globalThis!).gc(); heapUsed')
    ])
    expect(await findGcRuntimeViolations(root, files, new Set([resolve(root, files[1])]))).toEqual([
      files[0],
      files[3],
      files[4]
    ])
    await expect(findGcRuntimeViolations(root, ['missing.ts'], new Set())).rejects.toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
