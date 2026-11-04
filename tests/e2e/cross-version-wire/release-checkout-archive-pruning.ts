import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

type Git = (args: string[], maxOutputBytes?: number) => Promise<string>

const stale = /\.(test|bench|spec)\.(ts|tsx|mts|cts|js|mjs|cjs)$/
const staleInsensitive = /\.(test|bench|spec)\.(ts|tsx|mts|cts|js|mjs|cjs)$/i

function patterns(metadata: string, roots: string[]): string[] {
  if ((metadata && !metadata.endsWith('\0')) || metadata.includes('\uFFFD')) {
    throw new Error('Incomplete git tree output')
  }
  const entries = metadata
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d{6}) (\S+) ([0-9a-f]+)\t([\s\S]+)$/.exec(entry)
      if (!match) {
        throw new Error('Malformed git tree output')
      }
      return { mode: match[1], type: match[2], path: match[4] }
    })
  const withinRoots = (path: string): boolean =>
    roots.some((root) => path === root || path.startsWith(`${root}/`))
  const regular = (entry: (typeof entries)[number]): boolean =>
    ['100644', '100755'].includes(entry.mode) && entry.type === 'blob'
  const eligible = entries.filter(
    (entry) => regular(entry) && stale.test(entry.path) && withinRoots(entry.path)
  )
  const safeCompact =
    eligible.length > 32 &&
    entries.every((entry) => {
      const components = entry.path.split('/')
      if (components.slice(0, -1).some((component) => staleInsensitive.test(component))) {
        return false
      }
      if (!staleInsensitive.test(entry.path)) {
        return true
      }
      return stale.test(entry.path) && regular(entry) && withinRoots(entry.path)
    })
  if (safeCompact) {
    return ['test', 'bench', 'spec'].flatMap((kind) =>
      ['ts', 'tsx', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(
        (extension) => `*.${kind}.${extension} export-ignore\n`
      )
    )
  }
  return eligible.map(({ path }) => {
    const literal = `/${path.replace(/[\\*?[\]]/g, '\\$&')}`
    const quoted = Array.from(literal, (character) => {
      if (character === '\\' || character === '"') {
        return `\\${character}`
      }
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? `\\${code.toString(8).padStart(3, '0')}` : character
    }).join('')
    return `"${quoted}" export-ignore\n`
  })
}

export async function withReleaseArchivePruning(
  repoRoot: string,
  commit: string,
  paths: string[],
  git: Git,
  archive: (config: string[]) => Promise<void>,
  preparedRoots: string[] = paths
): Promise<void> {
  let directory: string | undefined
  let config: string[] = []
  try {
    const entries = patterns(
      await git(['ls-tree', '-r', '-t', '-z', commit, '--', ...paths], 8 * 1024 * 1024),
      preparedRoots
    )
    if (entries.length) {
      const fallback = join(
        process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
        'git',
        'attributes'
      )
      const configured = await git([
        'config',
        '--null',
        '--path',
        '--get',
        `--default=${fallback}`,
        'core.attributesFile'
      ])
      if (!configured.endsWith('\0') || configured.slice(0, -1).includes('\0')) {
        throw new Error('Malformed git config output')
      }
      const name = configured.slice(0, -1)
      let existing = Buffer.alloc(0)
      if (name) {
        try {
          existing = await readFile(isAbsolute(name) ? name : resolve(repoRoot, name))
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
            throw error
          }
        }
      }
      directory = await mkdtemp(join(tmpdir(), 'orca-release-attributes-'))
      const file = join(directory, 'attributes')
      await writeFile(file, Buffer.concat([existing, Buffer.from(`\n${entries.join('')}`)]), {
        mode: 0o600
      })
      config = ['-c', `core.attributesFile=${file}`]
    }
  } catch {
    if (directory) {
      await rm(directory, { recursive: true, force: true }).catch(() => {})
    }
    directory = undefined
  }
  try {
    await archive(config)
  } finally {
    if (directory) {
      await rm(directory, { recursive: true, force: true }).catch(() => {})
    }
  }
}
