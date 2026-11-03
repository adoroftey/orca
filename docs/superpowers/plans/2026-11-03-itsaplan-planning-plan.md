Accepted native planning implementation plan — 2026-11-03
Base a3bdb320; contract contract.txt; accepted-design.txt approved by live user.
Model: gpt-6.1-terra / medium for all bounded implementation/QA dispatches; research/architecture primary.
Repository no team profile; local tracker explicitly authorized ORCINT, existing own fork publication authorized.
No upstream/main merge, official app changes, or release. No personal-account claims from local fixture.

Done criteria:
1 Existing initiatives paged + authorized CRUD/linking + server progress/activity in native Tasks.
2 Existing Views roundtrip + parity filters + four layouts + editor/privacy/personal controls if API supports.
3 Existing dashboards + 11 widget types/authoritative metrics + layout/config editing + unknown-field preservation.
4 Transport scope/capability/permissions + old API compatibility; no regression of issue/workspace behavior.
5 Targeted regressions/typecheck/build/fixtures/live local evidence; tracker reflects actual verification.

Tasks (each author bounded to one contract mechanism or UI unit, no redesign):
T1 QA public planning transport/credentials fencing tests, ORCINT-20/24. needs:none. proves:4 (with integration evidence).
 Checks: vitest planning transport/request contract tests; native request invalid schema RED then GREEN.
T2 Shared planning DTO/schema + REST/IPC/RPC implementation per contract, ORCINT-19/20.
 needs:T1 red before mutation mechanism edits; new DTO scaffolding may parallel. contributes:1,2,3,4.
 Checks: client planning tests, IPC/request tests, runtime capability tests; node/web typecheck.
T3 Initiatives panel CRUD/paging/feed/linking, ORCINT-6/7/8. needs:fixed contract/T2 types (may author against contract).
 proves:1. Checks: panel workflows mocked actual shape, paging, permission/feature, changes+return, UI fixture.
T4 Views filter engine and data/layout semantics, ORCINT-11/12. needs:T2 DTO. contributes:2.
 Checks: upstream parity vectors, unknown filters, custom fields/cycle/initiative, stable sort/group/date edge cases.
T5 Views panel/editor and four layouts, ORCINT-10/12/13. needs:T4, T2. proves:2.
 Checks: load preexisting View, edits Save/Discard, unknown blobs retained, API support controls, issue open.
T6 Dashboard widget rendering/analytics and configuration, ORCINT-15/16/17. needs:T2. contributes:3.
 Checks: 11 types and unknown widgets, failures isolated, server response examples, editor Save/Discard/geometry/narrow.
T7 Native section shell + metadata + shared issue return, ORCINT-6/10/15. needs:T3,T5,T6 (placeholder mount may first wave).
 proves:3 (with T6 evidence); contributes:1,2,4. Checks: integration panel navigation and project/host switching.
T8 QA live local existing-object roundtrips, quality/typecheck/build/catalog/fixtures/docs, ORCINT-24/25/26.
 needs:T2..T7. proves:5 and closes 4 with independent review. No full suite green claim on timeout.
T9 Fresh source review across all contracts and permissions, then bounded fixes by owners.
 needs:T8 evidence. Spec closing read maps all 5 criteria to actual artifacts. No done status without evidence.

Assembly tasks split by obligation: transport owner owns capability+RPC; semantic owner owns filter fidelity;
shell owner owns shared issue/workspace return; each UI owner owns async guards/unknown-data preservation in its editor.
First runnable wave: Issues/Initiatives/Views/Dashboards navigation + existing Issues and Initiatives panel;
fixture shot task-page/itsaplan/Planning (owner creates fixture) demonstrates it without revealing windows.
Test commands use env ORCA_BACKGROUND_LAUNCH=1 node node_modules/vitest/vitest.mjs run --config config/vitest.config.ts <files> --maxWorkers=2.
Full checks primary: node config/scripts/run-typecheck-projects-in-parallel.mjs;
node config/scripts/run-electron-vite-build.mjs; check-changed.mjs --maxWorkers=2 (scoping/time limits reported).

Implementation paths: `src/main/itsaplan/`, `src/shared/itsaplan/`,
`src/shared/rpc-contract/`, `src/renderer/src/runtime/`, and
`src/renderer/src/components/task-page/itsaplan/`. The task descriptions above
are a plan and do not themselves establish completion or acceptance.
