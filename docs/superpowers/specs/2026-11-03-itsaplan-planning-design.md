It's a Plan planning features in Orca Tasks — proposed design
Date: 2026-11-03
Status: accepted by the user on 2026-11-03; implementation authorized

Problem and outcome
The existing native provider exposes issues but cannot load initiatives, saved
views or dashboards. Users must be able to open the same persisted project
objects available to their API-key identity and work with them inside Tasks.
The Itsplan server remains the source of truth. This is live REST access,
not a one-time import, a second database, or a logged-in embedded website.

Approach
Recommended: extend the native provider and its existing host-scoped transport.
An embedded web interface would reuse upstream UI but would require a separate
browser login and would not integrate with Tasks actions. Read-only native
screens would be smaller but would not satisfy working with the saved objects.

Navigation
Within Tasks > It's a Plan, keep the server and project selectors, then provide
Issues, Initiatives, Views and Dashboards. Existing issue details, comments,
and workspace actions remain available from every issue list. Back navigation
returns to the same initiative/view/dashboard with its active selection intact.
Use Orca components, theme tokens, translations and responsive layouts.

Initiatives
Load paginated existing initiatives; search and filter by lifecycle state.
Show description, owner, priority, start/target dates, labels, server-derived
progress and health, activity feed, and linked issues. Support creating,
editing and deleting initiatives, and linking/unlinking issues by initiativeId.
A new issue started in an initiative inherits that initiative unless changed.
Confirm destructive deletion. Keep task-to-workspace actions on linked issues.
File upload/storage management and document editing are outside this change;
existing references must not be discarded by an initiative edit.

Saved Views
Load project and personal saved views visible to the authenticated API identity.
Respect favorites, hidden state and personal tab order. Allow selection,
creation, rename, filter/display editing, duplication and deletion where allowed.
Personal/project privacy and publication follow the server's rules; do not
silently turn a shared view private or publish a private one.
Render saved Kanban, table, timeline and calendar layouts with saved sorting,
grouping/subgrouping, visible properties and date settings. Apply the upstream
filter semantics, including custom fields, cycles and initiatives. Expand the
issue/project payloads to supply these inputs; search hits alone are insufficient.
Keep unsaved edits separate, provide Save/Discard, and refresh from the server
after a successful save. Creating private views, favoriting, hiding, arranging
and publishing must use their own API operations and permissions.
Do not silently ignore an unknown filter or replace a configured layout with
an unfiltered issue list. Explain an unsupported configuration, preserve its
raw values, and provide its web link until supported.

Dashboards
Load existing project dashboards and their stored widget IDs, grid geometry,
titles and configuration. Support create, rename, duplicate, edit and delete;
add/remove/configure widgets and move/resize them, with explicit Save/Discard.
Support the upstream widget catalogue inspected for this design: stat,
recent_issues, activity_feed, pulse, throughput, burnup, breakdown, agent_runs,
agent_health, webhook_health and agent_workload. Query the authoritative
analytics/activity endpoints for time-series and operational metrics instead
of approximating their meaning from the active board alone. Issue widgets
open the existing native issue detail and workspace actions.
Preserve unknown widget/configuration properties and legacy layouts. Unknown
widgets remain identifiable placeholders, not silently removed entries.
A narrow viewport derives a stacked layout without saving mobile geometry
over the desktop layout. A failed widget does not erase the dashboard.

Data, permissions and compatibility
Reuse encrypted per-profile/per-host credentials, x-api-key, bounded responses,
validated requests, and expectedBaseUrl checks. Add explicit IPC/RPC contracts
and capability negotiation for the new features; an older remote runtime must
show update-required rather than route a write to the local instance.
Use project permissions and feature flags for navigation and mutation controls;
server authorization remains authoritative. Recognize read-only and forbidden
responses. Preserve unknown JSON properties during edits and send only the
changed fields. Do not render upstream HTML/scripts or execute widget content.
No merge into upstream/main, official-app replacement, or release is included.

Isolation and verification
Work and build in an isolated checkout so that the already running desktop fork
is not rebuilt underneath the user. Leave the official Orca process and profile
alone. Use an isolated background profile for automated application checks.
Seed initiatives, personal/project Views and dashboards through Itsplan before
opening them in Orca. Verify loading those existing objects, authorized CRUD,
issue linking, save/reload round trips, filter and metric parity, unchanged
unknown fields, permission failures, host/project/server switching, pagination,
and retention of existing issue/workspace workflows.
Include targeted contract, transport and UI tests; typecheck main/web/CLI;
production build; light/dark and narrow component fixtures; live local API and
runtime acceptance. Run check:changed before a push and report actual results.
Actual account acceptance additionally requires connecting the user's own
Itsplan instance/key; the current local fixture account cannot represent it.

Source contracts inspected
https://github.com/croffasia/itsaplan/blob/main/apps/api/src/modules/initiatives/index.ts
https://github.com/croffasia/itsaplan/blob/main/apps/api/src/modules/initiatives/model.ts
https://github.com/croffasia/itsaplan/blob/main/apps/api/src/modules/views/index.ts
https://github.com/croffasia/itsaplan/blob/main/apps/api/src/modules/views/model.ts
https://github.com/croffasia/itsaplan/blob/main/apps/api/src/modules/views/filters.ts
https://github.com/croffasia/itsaplan/blob/main/apps/api/src/modules/dashboards/index.ts
https://github.com/croffasia/itsaplan/blob/main/apps/api/src/modules/dashboards/model.ts
https://github.com/croffasia/itsaplan/blob/main/apps/web/src/utils/dashboardWidgets.ts
https://github.com/croffasia/itsaplan/blob/main/apps/web/src/utils/viewSettings.ts
https://github.com/croffasia/itsaplan/blob/main/apps/web/src/utils/viewTypes.ts
