# Tasks

Each file in this directory records one problem worth solving and what we knew about it when we wrote it down.

## These tasks are not implementation plans

A task captures our first understanding of a problem. It is not a design, and it is not a plan. Before writing code for any task:

1. Check that the problem still exists. The code may have changed since the task was written.
2. Design the change. Settle the open questions, compare more than one interface, and decide where the seam goes.
3. Plan the work, including how to test it.

Each section of a task file has a limited purpose:

- **Problem** describes what we observed. It is the most reliable part of the file, but it can still be incomplete.
- **Direction** is a first idea for a fix. Design may replace it.
- **Open questions** lists the decisions we already know about. Design will find more.
- **Done when** describes the outcome we expect. Revise it during design if the outcome changes.
- **Relevant code** lists where to start reading. It names files and symbols and leaves out line numbers, which go stale.

## Where the tasks came from

Most tasks come from the [2026-10-13 architecture review](../architecture-reviews/architecture-review-20261013-170319.html). The review looked at the areas that changed most in recent commits. It looked for modules whose interface is nearly as large as their implementation, logic copied between modules, and code that is hard to test through its current interface. Open the HTML file in a browser to see the before and after diagrams.

Each review task lists a strength:

- Strong means the change removes code or fixes a known problem, and the direction is clear.
- Worth exploring means the problem is real, but the direction needs discussion.
- Speculative means the current code works, and the gain is mostly testability.

A strong task still needs design before implementation. The strength describes how sure we are about the problem, not how ready the fix is.

## Priority order

Review tasks come before the tasks that existed before the review.

### From the architecture review

1. [share-renderer-event-store.md](share-renderer-event-store.md). Strong. Replaces 584 lines copied across four stores.
2. [fixture-gateway-on-query-seam.md](fixture-gateway-on-query-seam.md). Strong. Removes about 300 lines of fixture code.
3. [extract-tracking-session.md](extract-tracking-session.md). Worth exploring.
4. [derive-test-wiring-from-production.md](derive-test-wiring-from-production.md). Worth exploring.
5. [simplify-renderer-action-providers.md](simplify-renderer-action-providers.md). Worth exploring.
6. [move-settings-to-react-query.md](move-settings-to-react-query.md). Worth exploring.
7. [combat-log-parser-locality.md](combat-log-parser-locality.md). Worth exploring.
8. [app-state-key-schema-table.md](app-state-key-schema-table.md). Worth exploring.
9. [decide-wire-schema-placement.md](decide-wire-schema-placement.md). Worth exploring. Ends in an ADR.
10. [shared-boilerplate-helpers.md](shared-boilerplate-helpers.md). Worth exploring. Each section can land on its own.
11. [clean-up-detached-window.md](clean-up-detached-window.md). Worth exploring.
12. [quick-wins.md](quick-wins.md). Small independent items. Pick these up between larger tasks.
13. [electron-app-lifecycle-module.md](electron-app-lifecycle-module.md). Speculative.

### Existing tasks

14. [batch-dungeon-run-observation-inserts.md](batch-dungeon-run-observation-inserts.md).
15. [disconnect-livesplit-when-disabled.md](disconnect-livesplit-when-disabled.md).

### Found since the review

16. [restore-fellowship-logs-fixture-tests.md](restore-fellowship-logs-fixture-tests.md). Eight `apps/api` tests fail without a 13-page fixture capture.

## Dependencies

- Task 5 and task 6 should agree on how the renderer runs mutations.
- Task 2 and task 16 change the same fixture-reading code. Do one before the other, not in parallel.

## When a task is finished or rejected

Delete a task's file when the work lands, and update this list. Git history keeps the record.

If we decide not to do a task for a reason that will still hold later, record the decision as an ADR in `docs/adr/` before deleting the file. Future reviews then won't suggest it again.
