# Tasks

Each file in this directory describes one task: the problem, the proposed fix, and the relevant code. Delete a task's file when the work lands, and update this list.

Most tasks come from the [2026-10-13 architecture review](../architecture-reviews/architecture-review-20261013-170319.html). The review looked at the areas that changed most in recent commits. It looked for modules whose interface is nearly as large as their implementation, logic copied between modules, and code that is hard to test through its current interface. Open the HTML file in a browser to see the before and after diagrams.

Each review task lists a strength:

- Strong means the change removes code or fixes a known problem, and the design is clear.
- Worth exploring means the problem is real, but the design needs discussion before starting.
- Speculative means the current code works, and the gain is mostly testability.

## Priority order

Review tasks come before the tasks that existed before the review.

### From the architecture review

1. [unify-live-log-stream.md](unify-live-log-stream.md). Strong. Fixes the `Tracking` status bug and removes three translation steps.
2. [move-dungeon-run-store-into-db.md](move-dungeon-run-store-into-db.md). Strong. Unblocks observation batching.
3. [share-renderer-event-store.md](share-renderer-event-store.md). Strong. Replaces about 580 lines copied across four stores.
4. [fixture-gateway-on-query-seam.md](fixture-gateway-on-query-seam.md). Strong. Deletes about 300 lines of fixture code.
5. [extract-tracking-session.md](extract-tracking-session.md). Worth exploring. Easier after task 1.
6. [derive-test-wiring-from-production.md](derive-test-wiring-from-production.md). Worth exploring. Easier after task 2.
7. [simplify-renderer-action-providers.md](simplify-renderer-action-providers.md). Worth exploring.
8. [combat-log-parser-locality.md](combat-log-parser-locality.md). Worth exploring.
9. [app-state-key-schema-table.md](app-state-key-schema-table.md). Worth exploring.
10. [shared-boilerplate-helpers.md](shared-boilerplate-helpers.md). Worth exploring. Each section can land on its own.
11. [quick-wins.md](quick-wins.md). Small independent items. Pick these up between larger tasks.
12. [electron-app-lifecycle-module.md](electron-app-lifecycle-module.md). Speculative.

### Existing tasks

13. [tracking-status-after-stream-attaches.md](tracking-status-after-stream-attaches.md). Task 1 covers this. Close it when task 1 lands.
14. [batch-dungeon-run-observation-inserts.md](batch-dungeon-run-observation-inserts.md). Depends on task 2.
15. [disconnect-livesplit-when-disabled.md](disconnect-livesplit-when-disabled.md).

## Dependencies

- Task 1 replaces task 13.
- Task 2 comes before tasks 6 and 14.
- Task 5 builds on task 1.
- Task 4 and the first item in task 11 both delete `FellowshipLogsGateway.streamEvents`.
- Task 2 changes the `finishLocal` example in [docs/tracing.md](../tracing.md).
