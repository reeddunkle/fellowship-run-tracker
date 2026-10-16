# Make the Fellowship Logs fixture tests reproducible

## Problem

Eight `apps/api` integration tests fail on a machine whose recorded Fellowship Logs fixture has fewer pages than the tests expect:

- `fellowship-logs-dungeon-run-importer-resume.test.ts` (all 5 tests)
- `fellowship-logs-dungeon-run-importer.test.ts` ("reports progress as report pages are fetched")
- `background-job-queue-waiting.test.ts` ("resumes a waiting import from the page it stopped on")
- `fellowship-logs-analytics.test.ts` ("records live requests and cache hits, and saves them when the app shuts down")

Each one fails with `ENOENT` reading `apps/api/fixtures/fellowship-logs/XdfFZzgHBJNr6m3v-fights-15/page-2.json`.

`controlled-fellowship-logs-fixture-layer.ts` hard-codes `RECORDED_FIGHT_PAGE_COUNT = 13` and reads `page-1.json` through `page-13.json`. The fixtures are git-ignored (`apps/api/fixtures/` in `.gitignore`), so each machine has whatever its last `capture-fellowship-logs-report` run wrote. On the machine where this showed up, the capture is a single `page-1.json` (2.2 MB) whose `nextPageTimestamp` is `null`. Fellowship Logs may now return the whole fight in one page, so a fresh capture may never produce the 13 pages the tests assume.

Every other test that uses the fixture still passes, because it reads only `metadata.json` and `page-1.json`.

## Direction

Make the multi-page tests independent of a live capture. Options:

- Build the pages these tests need from the single recorded page, by splitting its events into several pages and chaining their `nextPageTimestamp` values.
- Commit a small, purpose-made multi-page fixture for these tests, separate from the git-ignored capture.
- Derive the page count from the fixture directory and skip or adapt the multi-page cases when the capture has only one page.

## Open questions

- Does the live API still paginate this fight, or has the page size changed for good? Re-run `capture-fellowship-logs-report` against the same report and compare.
- Which tests need real recorded data, and which only need "more than one page"?
- Should these fixtures be committed at all, given their size?

## Done when

- The eight tests pass on a fresh clone after the documented fixture setup, or no longer need the git-ignored capture.
- The page count the tests rely on isn't hard-coded separately from the fixture it describes.

## Relevant code

- `apps/api/src/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts` (`RECORDED_FIGHT_PAGE_COUNT`)
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-fixture-paths.ts`
- `apps/cli/src/commands/capture-fellowship-logs-report-command.ts`
- `.env.example` (`FELLOWSHIP_LOGS_FIXTURE_DIRECTORY`, `FELLOWSHIP_LOGS_USE_FIXTURES`)
- [fixture-gateway-on-query-seam.md](fixture-gateway-on-query-seam.md) changes the same fixture-reading code.
