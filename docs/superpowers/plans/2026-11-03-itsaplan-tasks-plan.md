# Native It's a Plan Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make It's a Plan a working native Orca Tasks source with issue editing and durable workspace linkage.

**Architecture:** Follow existing Linear/Jira boundaries: main REST/credential service, local preload and host-qualified runtime RPC, native Tasks content, generic workspace attachments and contained startup context. Three implementation owners share a contract, never a writable file.

**Tech Stack:** Existing TypeScript, Electron, React, Zod, Vitest and shadcn primitives; no new dependencies.

## Global constraints

- Accepted design: `docs/superpowers/specs/2026-11-03-itsaplan-tasks-design.md`; baseline `ee532e571c074392c5ecddeb22b60a63e71f85c4`, branch `feat/itsaplan-tasks`.
- Keep credentials on their selected execution host and out of UI persistence/logs; encode project refs; reject credential redirects; validate IPC/RPC and REST inputs/results.
- API and web URL are distinct settings. Priority is string/null; assignee is `assigneeUserId`; board pagination is client-side over the complete active response.
- Reuse generic `linkedItems`/`linkedWorkItem` rather than a new provider-specific issue slot. Preserve Git and folder-workspace links and existing providers.
- Tests/apps use `ORCA_BACKGROUND_LAUNCH=1`; no visible Electron launch. Follow `docs/STYLEGUIDE.md`. No agent stages, commits, pushes, merges or modifies dependencies.

## Task A: REST, credentials, preload and runtime

**Ownership:** new `src/main/itsaplan/**`, `src/main/ipc/itsaplan/**`, `src/shared/itsaplan/**`, `src/shared/rpc-contract/itsaplan-params.ts`, `src/main/runtime/rpc/methods/itsaplan.ts`, `src/preload/api/itsaplan-api.ts`, `src/preload/api/itsaplan-bridge.ts`, `src/renderer/src/runtime/runtime-itsaplan-client.ts`. Narrow registration edits: `src/main/ipc/register-core-handlers/register-core-handlers.ts`, `src/preload/index.ts`, `src/preload/api-types.ts`, `src/main/runtime/rpc/methods/index.ts`; runtime command/capability and browser preload registration files needed by this provider belong to A. QA-owned new tests are read-only to the implementer.

**Interfaces:** A publishes `ItsaplanProject`, `ItsaplanProjectDetails`, `ItsaplanIssue`, `ItsaplanIssueCreate`, `ItsaplanIssueUpdate`, `ItsaplanCommentPage`, `ItsaplanConnectionStatus`, `ItsaplanConnectArgs` and `ItsaplanApi` from `src/shared/itsaplan/types.ts` before B/C import them. `createItsaplanClient({baseUrl, apiKey, fetch?})` in `src/main/itsaplan/client.ts` is the transport seam for QA's injected-fetch tests. `ItsaplanApi` contains `status()`, `connect(args)`, `disconnect()`, `listProjects()`, `getProject(projectRef)`, `listIssues(projectRef)`, `searchIssues(projectRef,query,limit?)`, `getIssue(issueId)`, `createIssue(projectRef,input)`, `updateIssue(issueId,updates)`, `listComments(issueId,options?)` and `addComment(issueId,body)`; return the corresponding normalized DTOs and throw sanitized errors. Export `createItsaplanRuntimeClient(source: TaskSourceContext | RuntimeClientTarget): ItsaplanApi` from the renderer runtime module. Route by the explicit owner to local `window.api.itsaplan` or the remote RPC; Tasks reuses its model host, while Settings resolves its default scope once before calling the factory. One configured server per execution host; no new global credential settings. Use the independently authored REST contract, including keyset-paginated comment feed.

- [ ] A1: Read upstream issue/project/column/member REST models and the QA client tests; publish the concrete exports and renderer wrapper signatures to B/C before they implement callers.
- [ ] A2: Run QA red tests: `ORCA_BACKGROUND_LAUNCH=1 pnpm test src/main/itsaplan --maxWorkers=2`; expected missing client/connection implementation, not a fixture failure. Preserve those tests.
- [ ] A3: Implement URL canonicalization, bounded no-redirect requests, real endpoint mapping and sanitized errors. Validate credentials before encrypted save; make disconnect remove the stored secret. Add input schemas and explicit remote capability behavior.
- [ ] A4: Register local and remote paths, including browser/mobile transport. Add integration tests for failed replacement preserving the old connection and remote calls never using local credentials.
- [ ] A5: Run the same targeted tests to green, plus scoped `oxlint`/`oxfmt` on A's files; report exact commands, results and any out-of-perimeter registration requirement.

## Task B: Native Tasks screens and race-safe state

**Ownership:** `src/renderer/src/components/task-page/**`, including `task-page-localized-options.tsx`; new view-specific state under that subtree. B owns `Content.tsx`, `Frame.tsx`, `Surface.tsx`, `SourceBar.tsx`, source availability/display/summary hooks and other task-page integration files. B does not edit shared provider definitions, renderer runtime client or workspace libraries.

**Interfaces:** Consume A's DTOs and `createItsaplanRuntimeClient(source)`. Consume C's `buildItsaplanIssueComposerData(issue, project, connection, source)` from `src/renderer/src/lib/itsaplan-linked-work-item.ts`, returning `{prefilledName, linkedWorkItem, taskSourceContext}`. Build the source with `normalizeTaskSourceContext` using provider `itsaplan`, the selected host, and `providerIdentity: {provider:'itsaplan',baseUrl:connection.baseUrl,projectRef:project.ref}`; open the standard new-workspace composer with C's data. Fetch full detail before calling that helper.

- [ ] B1: Write rendered/hook tests for disconnected source content, board load/filter/pagination, capped server search and paginated comments, opening a full detail and stale response after project/host change; run red before implementation.
- [ ] B2: Add explicit Itsaplan route before Jira fallback. Build connect/project controls and list/detail/create forms from existing primitives. Keep state keyed by host/server/project; invalidate or ignore old requests and surface retryable failures.
- [ ] B3: Wire status/priority/assignee changes and comments to A's actual metadata/API contract, refreshing the current scope after successful writes. Preserve unsaved form data on errors. Display full description only from detail read.
- [ ] B4: Add create/attach-workspace actions with C's composer helper and existing actions. Hide unrelated provider controls for this source; keep existing Tasks layout and keyboard behavior.
- [ ] B5: Run B's targeted tests to green and scoped formatting/lint. Describe exact fixture viewport/state for any visual validation; never reveal an Electron window.

## Task C: Provider admission, persistent links and launch context

**Ownership:** `src/shared/task-providers.ts`, `task-provider-identity.ts`, `task-source-context.ts`, related provider/schema/identity tests; `src/shared/worktree/types.ts`, workspace attachment/reference/linked-item normalizers and tests, folder projection/source schema paths; `src/shared/new-workspace/**` and `workspace-name.ts` when needed; renderer workspace libraries and startup/composer paths, `src/renderer/src/components/new-workspace/**`, settings provider selector. B owns `task-page/task-page-localized-options.tsx`. Never edit A's Itsaplan DTO/RPC/client files or B's remaining task-page files. Send any necessary main-runtime/persistence registration change to A or the controller as handoff.

**Interfaces:** Add `itsaplan` to `TaskProvider` and provider identity using canonical server URL plus project reference (`baseUrl`, `projectRef`). `buildItsaplanIssueComposerData(issue: ItsaplanIssue, project: ItsaplanProject, connection: ItsaplanConnectionStatus, source: TaskSourceContext)` returns the standard composer fields and a linked item whose `linkedContext` contains title, description and URL; use existing `LinkedWorkItemSummary` and `buildContainedLinkedContextBlock`. Extend existing generic persistent links and admission validators, keeping backward compatibility.

- [ ] C1: Write red tests for provider selection while disconnected, server/project identity isolation, JSON save/reload of both worktree/folder links, attachment normalization and issue launch context. Use actual normalized fields agreed with A.
- [ ] C2: Extend catalog, source normalizers, cache identity and settings admission. Give Itsaplan explicit availability rather than the current `linearConnected` fallthrough; B adds its source option/icon using that admitted provider.
- [ ] C3: Trace linked item through composer, persistence schema/RPC, metadata normalization, folder projection and rendering. Extend every admission boundary that would drop `itsaplan`; retain its generic identifier/title/URL and source identity. Avoid broad provider refactors.
- [ ] C4: Implement the composer helper and preserve source on repo changes. Reuse contained context rules so issue prose cannot escape its source-data block. Expose existing-workspace attachment as well as new-workspace creation.
- [ ] C5: Run C's targeted tests to green plus existing attachment/source/composer regression tests and scoped formatting/lint; report any file needing another owner's edit.

## Controller integration and release evidence

Commands below are prospective implementation checks, not claims of an executed suite. If the pnpm shim fails, use the controller-provided official pnpm JS launcher with the same arguments; do not rewrite the lockfile.

- [ ] Run A first through contract publication/QA red evidence; B and C can then proceed with disjoint ownership. Reconcile handoffs only after each owner's report, with a new explicit ownership assignment.
- [ ] Review design acceptance items against the combined diff; independently review credentials/URL isolation, stale requests, and persistent links. Fix findings without weakening QA tests.
- [ ] Run `ORCA_BACKGROUND_LAUNCH=1 pnpm tc:node`, `pnpm tc:web`, `pnpm tc:cli`, targeted provider/workspace suites and scoped lint/format; record baseline failures separately. Run `pnpm check:flaky-test-pattern-ratchet` and applicable changed-code checks.
- [ ] Run `ORCA_BACKGROUND_LAUNCH=1 pnpm check:changed` after the last edit before any authorized push. Report delivered behavior, evidence and remaining live-server/custom-build verification honestly. Do not merge upstream or install over the user's Orca.
