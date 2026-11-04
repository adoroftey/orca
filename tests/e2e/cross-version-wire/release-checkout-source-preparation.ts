import { readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { createWorkspaceSourceResolver } from '../../../config/scripts/workspace-source-exports.mjs'
import { collectPackageImports, type PackageImports } from './release-missing-packages.ts'

const WORKSPACE_POLICY = 'pnpm-workspace.yaml'

const ALIAS_SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])@(renderer)?\/([^'"]+)\2/g

// Static, side-effect, lazy and CommonJS loads of a bare specifier.
const BARE_SPECIFIER =
  /(\bfrom\s*|^\s*import\s*|(?<![.\w$])import\s*\(\s*|(?<![.\w$])require\s*\(\s*)(['"])([^'"\s./][^'"\s]*)\2/gm

type WorkspaceSourceResolver = ReturnType<typeof createWorkspaceSourceResolver>

// Include package JS too: orca-source exports may target any supported module extension.
function isRewritableSource(name: string): boolean {
  return /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(name)
}

function isTestSource(name: string): boolean {
  return /\.(test|bench|spec)\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(name)
}

/** Keep renderer aliases inside the extracted release rather than the working tree. */
async function rewriteRendererAliases(
  file: string,
  source: string,
  rendererRoot: string
): Promise<string> {
  if (!source.includes("'@/") && !source.includes('"@/') && !source.includes('@renderer/')) {
    return source
  }
  const rewritten = source.replace(
    ALIAS_SPECIFIER,
    (_match, keyword: string, quote: string, _renderer: string | undefined, target: string) =>
      `${keyword}${quote}${relativeSpecifier(file, join(rendererRoot, target))}${quote}`
  )
  if (rewritten !== source) {
    await writeFile(file, rewritten)
  }
  return rewritten
}

function relativeSpecifier(file: string, absolute: string): string {
  const relativePath = relative(dirname(file), absolute).split('\\').join('/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

/** Why: the install link and vitest's workspace aliases would otherwise load current packages. */
async function rewriteWorkspaceImports(
  root: string,
  file: string,
  source: string,
  resolver: WorkspaceSourceResolver
): Promise<string> {
  const rewritten = source.replace(
    BARE_SPECIFIER,
    (match, keyword: string, quote: string, specifier: string) => {
      let target: ReturnType<WorkspaceSourceResolver['resolve']>
      try {
        target = resolver.resolve(specifier)
      } catch (error) {
        throw new Error(`${relative(root, file)}: ${String(error)}`)
      }
      // Native packages can't be built from the release, so they keep the current install.
      return target
        ? `${keyword}${quote}${relativeSpecifier(file, join(root, target.file))}${quote}`
        : match
    }
  )
  if (rewritten !== source) {
    await writeFile(file, rewritten)
  }
  return rewritten
}

export function releaseSourcePreparationRoots(workspacePaths: string[]): string[] {
  return [
    'src',
    ...workspacePaths.filter(
      (path) => path !== WORKSPACE_POLICY && !path.startsWith('src/') && !path.startsWith('native/')
    )
  ]
}

export async function prepareExtractedTree(
  root: string,
  workspacePaths: string[],
  packageImports: PackageImports
): Promise<void> {
  const resolver = workspacePaths.length > 0 ? createWorkspaceSourceResolver(root) : null
  const rendererRoot = join(root, 'src', 'renderer', 'src')
  const walk = async (directory: string): Promise<void> => {
    const tasks: { file: string; remove: boolean }[] = []
    const collect = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name)
        if (entry.isDirectory()) {
          await collect(file)
        } else if (entry.isFile() && (isTestSource(entry.name) || isRewritableSource(entry.name))) {
          tasks.push({ file, remove: isTestSource(entry.name) })
        }
      }
    }
    await collect(directory)
    const results: (PackageImports | undefined)[] = Array.from({ length: tasks.length })
    let next = 0
    let failed = false
    let firstError: unknown
    const worker = async (): Promise<void> => {
      while (!failed && next < tasks.length) {
        const index = next++
        const { file, remove } = tasks[index]
        try {
          if (remove) {
            await rm(file)
          } else {
            let source = await rewriteRendererAliases(
              file,
              await readFile(file, 'utf8'),
              rendererRoot
            )
            if (resolver) {
              source = await rewriteWorkspaceImports(root, file, source, resolver)
            }
            const imports: PackageImports = new Map()
            collectPackageImports(source, imports)
            results[index] = imports
          }
        } catch (error) {
          if (!failed) {
            failed = true
            firstError = error
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(16, tasks.length) }, () => worker()))
    if (failed) {
      throw firstError
    }
    for (const imports of results) {
      if (!imports) {
        continue
      }
      for (const [name, members] of imports) {
        let existing = packageImports.get(name)
        if (!existing) {
          existing = new Set()
          packageImports.set(name, existing)
        }
        for (const member of members) {
          existing.add(member)
        }
      }
    }
  }
  for (const path of releaseSourcePreparationRoots(workspacePaths)) {
    await walk(join(root, path))
  }
}
