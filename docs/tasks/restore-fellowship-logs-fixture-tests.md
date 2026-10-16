# Make the Fellowship Logs fixture tests reproducible

## Problem

The `apps/api` tests that import a Fellowship Logs fight need a recorded capture in `apps/api/fixtures/fellowship-logs/XdfFZzgHBJNr6m3v-fights-15/`. The fixtures are git-ignored (`apps/api/fixtures/` in `.gitignore`), so a fresh clone has none, and every test that reads them fails until someone runs `capture-fellowship-logs-report`.

The tests no longer depend on how many pages the capture has. `controlled-fellowship-logs-fixture-layer.ts` splits the recorded events into `CONTROLLED_PAGE_COUNT` synthetic pages, so the multi-page tests pass with a single-page capture.

The last capture on this machine came back as a single `page-1.json` (2.2 MB) whose `nextPageTimestamp` is `null`. Earlier captures of the same fight had 13 pages, so Fellowship Logs may have changed its page size.

## Direction

Make the fixture tests runnable on a fresh clone. Options:

- Commit a small, purpose-made fixture for the tests, separate from the git-ignored capture.
- Document the capture step as part of test setup, and skip the fixture tests with a clear message when the capture is missing.

## Open questions

- Does the live API still paginate this fight, or has the page size changed for good? Re-run `capture-fellowship-logs-report` against the same report and compare.
- Should a fixture be committed at all, given its size? A trimmed fight might be small enough.

## Done when

- The fixture tests pass on a fresh clone, or skip with a message that says how to capture the fixture.

## Relevant code

- `apps/api/src/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts` (`CONTROLLED_PAGE_COUNT`, page splitting)
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-file-query.ts`
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-fixture-paths.ts`
- `apps/cli/src/commands/capture-fellowship-logs-report-command.ts`
- `.env.example` (`FELLOWSHIP_LOGS_FIXTURE_DIRECTORY`, `FELLOWSHIP_LOGS_USE_FIXTURES`)
