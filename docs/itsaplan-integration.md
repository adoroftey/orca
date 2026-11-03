# It's a Plan in Tasks

This Orca fork adds It's a Plan as a native Tasks source. It uses the tracker REST API;
no MCP server or external agent runner is required for browsing and editing tasks.

## Connect

1. Open **Tasks → It's a Plan**. If the source is hidden, enable it in **Settings → Tasks**.
2. Enter the **API URL** of your instance and a personal API key from It's a Plan.
3. Set **Web URL** when the web interface uses a different address. Otherwise it defaults
   to the API URL. For example, a local Docker installation may use `http://localhost:3000` for API
   and `http://localhost:3001` for web.
4. Connect and select a project.

One connection is stored per Orca profile on the selected execution host. Switching the
host switches the connection scope. Remote hosts must run a build with this integration;
older hosts show an update-required message. The host OS keyring must provide secure
credential storage. Orca verifies the API key before replacing an existing connection,
and a failed replacement keeps the prior one.

Explicit HTTP addresses are supported for local or private self-hosted instances. Server
URLs cannot contain credentials, a query or a fragment. API requests do not follow redirects.

## Work with tasks

Tasks lists the active project board with local pagination. Filter by status or assignee,
refresh the list, and open an issue to read its full description and paginated comments.
You can create issues, edit their title, description, status, priority and assignee, and
add comments. Agent candidates use delegation in It's a Plan, so the assignee selector
lists member candidates.

Text search uses the server search endpoint. It can include archived issues and returns
at most 500 matches; narrow a search that reaches the cap. This endpoint has no server
pagination. The board endpoint supplies the complete active list, while full descriptions
are loaded separately for an issue.

Use the issue workspace action to open a linked workspace, create a new one through the
standard composer, or attach the issue to an existing workspace on the same host. Links
include server and project identity and support Git worktrees and folder workspaces.
New workspace startup includes the issue title, description and web link as contained task
context. Completing an agent run does not automatically close the issue.

## Planning

After selecting a project, use **Issues**, **Initiatives**, **Views**, and
**Dashboards** to navigate its planning objects. The server remains the source
of truth: saves write to the same tracker, subject to the API identity's
permissions and the server's supported capabilities. Issue details and workspace
actions remain available from planning lists.

**Initiatives** loads the existing paginated list, with search and lifecycle
filters. Open an initiative for its details, progress, activity and linked
issues. Where permitted, create, edit or delete initiatives and link or unlink
issues. Deletion requires confirmation.

**Views** opens saved project and personal views available to the API identity.
The supported layouts are Kanban, table, timeline and calendar. Where permitted,
create, rename, duplicate, delete and edit filters and display settings. Changes
remain a draft until **Save**; **Discard** abandons them. Unsupported filters
or settings are identified instead of silently showing an unfiltered result;
use the web link for configurations that cannot be displayed. Personal and
privacy controls depend on the server's capabilities. The local 1.9.0 server
lacks private view creation, hidden state, personal tab order and publishing;
those operations require a server that supports them.

**Dashboards** loads saved dashboards and widgets. Where permitted, create,
rename, duplicate and delete dashboards; edit widget configuration and layout,
then **Save** or **Discard** the draft. The widget types are `stat`,
`recent_issues`, `activity_feed`, `pulse`, `throughput`, `burnup`, `breakdown`,
`agent_runs`, `agent_health`, `webhook_health`, and `agent_workload`. Widgets
use their corresponding issue, activity or analytics data; unavailable data or
a failed widget is shown as such. A forecast without sufficient data remains
empty rather than being invented. Unknown widgets and settings remain visible
as unsupported. A narrow display stacks widgets without writing that temporary
layout over saved geometry.

Edits send changed fields rather than replacing the entire object. A partial
save or conflict can require a refresh and another edit; check the displayed
result before retrying. **Discard** drops unsaved draft changes, not changes
already accepted by the server.

## Run the fork

Use the Node version and pnpm version declared in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

For a JavaScript desktop build without packaging an installer:

```sh
pnpm build:cli
pnpm build:electron-vite
```

Agent-run tests and application checks must use `ORCA_BACKGROUND_LAUNCH=1`; keep Electron
windows hidden as required by `AGENTS.md`. Useful checks for this integration include
`pnpm tc:node`, `pnpm tc:web`, `pnpm tc:cli`, targeted provider tests, and `pnpm check:changed`
before pushing. Successful fixture tests alone do not establish live-server acceptance.

The official installed Orca application is separate from this fork. These commands
do not install over or replace the official application. Local fixture results do not
establish full desktop, mobile, remote-host or personal-account acceptance.
