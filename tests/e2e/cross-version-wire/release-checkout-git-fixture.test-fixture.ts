import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Every fixed archive path must exist in a release, or `git archive` refuses the pathspec.
const RELEASE_SKELETON: Record<string, string> = Object.fromEntries(
  [
    'src/main/placeholder.ts',
    'src/shared/placeholder.ts',
    'src/preload/placeholder.ts',
    'src/renderer/src/placeholder.ts',
    'src/types/placeholder.ts',
    'mobile/src/worktree/agent-row-display.ts'
  ].map((path) => [path, 'export {}\n'])
)

export function commitRelease(
  temporaryDirectory: (prefix: string) => string,
  files: Record<string, string>,
  setup?: (repo: string) => void
): { repo: string; commit: string } {
  const repo = temporaryDirectory('orca-cross-version-release-repo-')
  for (const [path, source] of Object.entries({ ...RELEASE_SKELETON, ...files })) {
    mkdirSync(join(repo, path, '..'), { recursive: true })
    writeFileSync(join(repo, path), source)
  }
  const git = (args: string[]): string =>
    execFileSync('git', ['-c', 'core.autocrlf=false', ...args], {
      cwd: repo,
      encoding: 'utf8'
    }).trim()
  git(['init', '--quiet'])
  setup?.(repo)
  git(['add', '--all'])
  git([
    '-c',
    'user.name=release',
    '-c',
    'user.email=release@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--quiet',
    '--message',
    'release'
  ])
  writeFileSync(join(repo, 'package.json'), '{ "dependencies": {} }\n')
  return { repo, commit: git(['rev-parse', 'HEAD']) }
}
