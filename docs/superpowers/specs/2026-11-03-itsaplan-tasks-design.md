# Native It's a Plan Tasks integration

Date: 2026-11-03. Status: implemented on `feat/itsaplan-tasks`; validation evidence is recorded separately.

## Problem and baseline

Main: reproduced: yes at `src/shared/task-providers.ts:TaskProvider` and `src/shared/task-source-context.ts:normalizeTaskProvider`, base `ee532e571c074392c5ecddeb22b60a63e71f85c4`. A person using It's a Plan cannot select its server in Orca Tasks, work with its issues, or create a linked workspace. The user explicitly chose a native provider modeled on Linear/Jira and requested implementation in `adoroftey/orca`.

## Decision and alternatives

Add the native `itsaplan` provider through the existing credential, IPC/runtime, Tasks and workspace-source paths. Preserve existing providers and their data. A separate panel fails the accepted Tasks requirement; a general plugin-provider framework adds an unrelated extension boundary. The direct provider has the smallest reviewable change. Maintenance follows the existing provider pattern; rollback removes its registration while preserving saved attachment data for a later return. This needs a custom Orca build until accepted upstream.

## Target architecture

1. Main-process REST client and connection service own API requests and encrypted credentials. Local preload and validated runtime RPC expose the same typed operations. Renderer calls use an explicit `TaskSourceContext | RuntimeClientTarget` owner. Tasks reuses its model host; Settings resolves its default scope once and shares that target. The runtime factory does not accept a default-scope settings bag. There is no renderer `fetch` or local fallback for a remote owner.
2. Native Tasks source opens its own connect/list/detail/create content. Extend the existing source picker and route explicitly before the Jira fallback in `task-page/Content.tsx:TaskPageContent`. Keep the source selectable while disconnected, unlike the current Linear availability fallback.
3. Persist issue references using existing `linkedItems`, `linkedWorkItem` and task-source context. Extend their type unions and normalizers; do not add another provider-specific legacy issue slot. Worktree and folder-workspace links share these mechanisms.

## Connection and REST contract

Configure one server per execution host with API `baseUrl`, API key and optional `webBaseUrl` (defaults to API URL). They are distinct because self-hosted It's a Plan commonly serves API and web on different origins. Verify access before replacing the saved connection; display no key in persisted renderer state, logs or error text. Use existing `credentials/integration-credential-file` protection rather than plain text files. Permit explicit HTTP self-hosted/local endpoints; refuse credentials in URLs, unsupported schemes, query/fragment and redirects carrying the API key. Bound requests and return sanitized failures.

Use the upstream REST implementation as the endpoint authority: `croffasia/itsaplan`, `apps/api/src/modules/issues/index.ts:issueRoutes` and `model.ts:IssueResponse`, plus project/column/member routes, at `96319025061a42e3e4e29e0341fbf83d7e2aba9f`. Issue priority is `string | null`, assignee is `assigneeUserId: string | null`, and `columnId` is numeric. The active board endpoint `/projects/:projectKey/issues/board` returns the complete active set with empty descriptions; fetch `/issues/:issueId` for full details. Its board route at `apps/api/src/modules/issues/index.ts:518-533@96319025061a42e3e4e29e0341fbf83d7e2aba9f` accepts no list pagination query, so visible list pagination and supported filters operate over the complete loaded set, never invented server pagination. Project references are encoded as path segments. Endpoint-specific response validation happens before rendering.

## User behavior and consistency

- Connection/project selection precedes list reads. Show loading, empty, failure/retry and disconnected states distinctly.
- Search and filter by status/assignee; paginate the visible board list. Server search covers description/custom fields but is capped at 500 and must disclose a reached cap; never imply complete server paging. Preserve comment feed keyset pagination and replies. Project/host/server changes clear old rows and cancel or ignore late results. Refresh after successful writes; keep failures visible and editable drafts intact.
- Read full issue description, show/add comments, create an issue and edit title, description, column/status, priority and assignee using metadata from that project. Assignee candidates are members, while agents use delegation semantics. Use project `.ref`, not `.key`, since keys may repeat across teams.
- Identity includes canonical server URL, project reference and issue ID. Same numeric IDs on other servers/projects must never match a cached row or workspace link.
- Create workspace from a task and attach a task to an existing workspace. Preserve links across reload and present the task's identifier/title/URL. Both folder workspaces and Git worktrees are supported.
- Startup carries title, full description and URL through existing contained linked-context formatting (`linked-work-item-context.ts:buildContainedLinkedContextBlock`), preserving its untrusted-source delimiters and length bound.
- Use current UI primitives/tokens and translated copy; remote/mobile use the same RPC contract. An older runtime lacking the integration gives an update-required message rather than a request on the wrong machine.

## Done when

1. Tasks shows It's a Plan before connection; connect, list, search/filter, detail, create/update and comment flows succeed against a representative REST fixture, with no Jira content shown.
2. A delayed response from a previous project/host cannot replace the current list or detail; writes refresh the selected scope only.
3. Invalid connection and redirect tests fail safely, and API keys appear in neither persisted UI state nor surfaced errors.
4. A serialized/reloaded worktree and folder workspace retain the issue and source identity; equal issue IDs on different servers/projects remain separate.
5. Creating a workspace passes its selected issue description and URL into the agent's contained context; existing provider tests remain green.
6. Targeted tests and applicable node/web/CLI typechecks pass. Scoped formatting/lint and repository `check:changed` run after the last edit before any push; unexecuted checks are reported honestly.

## Non-goals and current state

No plugin framework, Linear Projects/custom views, kanban, automatic closure on agent completion, modifications to It's a Plan, upstream publication or installation over the user's existing Orca. As built at the baseline: none of this integration exists; this document describes the target, not delivered behavior.
