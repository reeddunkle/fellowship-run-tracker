# Fellowship Logs UI

## Implementation status

Step 6 is split into three slices:

| Slice | Scope | Status |
| --- | --- | --- |
| 6.1 Connection section | Profile choice, browser sign-in with cancel and manual fallback, own-client forms, connected status, opt-in recheck, reconnect, change, and disconnect, with local-protection and replacement confirmations; imports gated on a usable connection | Complete in the renderer |
| 6.2 Quota and waiting jobs | Three point pools with the beta policy, the import cost estimate, waiting-job reasons with their actions, and the confirmed move of a held job to the current connection | Complete in the renderer |
| 6.3 Settings cleanup and accessibility | Remove Settings credential controls and the legacy settings credentials, and pass the keyboard, focus-return, and screen-reader checks | In progress: cleanup complete, accessibility checks remain |

Slice 6.1, the connection section, is complete in the renderer:

- A Connection card sits directly below the page header. It reads `GET /fellowship-logs/connection` and polls it every second only while a sign-in is pending.
- With no connection, it leads with Connect with Fellowship Logs, marked Recommended, and its point-system opt-in notice. Use my own API client and Use my own client and sign in sit under a "Use your own Fellowship Logs client" disclosure. Each profile lists who owns the credentials, whether there's a browser sign-in, whose points are spent and in what order, which reports it can import, what happens when points run out, and that credentials are stored encrypted on the device. There are no username or password fields.
- Use my own API client checks the client ID and secret before saving them. Use my own client and sign in shows the public-client and redirect requirements, and requires a checkbox acknowledging that imports spend the client's points once the user's own points run out.
- While a sign-in is pending, the card shows the expiry, a Cancel sign-in action, a copy action for the sign-in link (labelled for the case where the browser didn't open), and a field for pasting the callback address after finishing in another browser. A pending own-client sign-in also shows the client requirements.
- Declined, expired, and failed sign-ins are explained in the chooser; an expired own-client sign-in and an `OWN_CLIENT_REJECTED` failure show the client requirements again. An outcome appears only for a sign-in started in this view, so an old failure never sits next to a working connection.
- A connected card shows the signed-in name or profile, a status badge, the spending policy, the storage protection, and the client ID for own-client profiles. The recommended profile adds the one-application-point hold note. When the opt-in is missing, it shows the three steps, an Open account settings link, and Check again, which reports when Fellowship Logs still sees no opt-in. When reauthorization is needed, Sign in again is the primary action.
- Change connection reopens the chooser with a way to keep the current connection. Replacing a connection and using local encryption are each confirmed in place. Every connection command sends the generation of the connection shown, or `null` when none is shown, and a replacement retry reuses it. A stale generation shows that the connection changed and requires a fresh choice. A sign-in that completes after the connection changed shows the `CONNECTION_CHANGED` failure next to the newer connection.
- Disconnect asks for confirmation in a labelled alert dialog. It says the sign-in or secret stored on the device is deleted and that runs, the queue, and cached reports stay. It does not claim that Fellowship Logs revokes access.
- Looking up a run is blocked with a specific message unless the connection is usable: no connection, reauthorization required, or the opt-in missing.
- Browser tests cover the profile layout, the replacement and local-encryption confirmations and the exact options retried, including the expected generation, the connection-changed error and sign-in outcome, the pending sign-in with the pasted callback, the opt-in recheck, the disconnect wording, and the stale-outcome rule. A unit test covers the import gate messages.

Open for 6.1:

- The Open account settings link uses `https://www.fellowshiplogs.com/profile`, which is unverified; the site did not render for an automated check. It lives in one constant.
- The section was checked in component tests and screenshots, not end to end in the Electron app against Fellowship Logs.

Slice 6.2, quota and waiting jobs, is complete in the renderer:

- A Points card replaces the Rate limit card. It reads `GET /fellowship-logs/point-pools` and shows the user, application, and database pools, labelled and ordered by the active profile: the recommended profile spends your points and holds one point in the app's shared allowance; Use my own API client spends the client's points; Use my own client and sign in spends your points first, then the client's. Each pool shows what is left and "Resets in 37 minutes, at 3:15 PM". A pool whose reset time has passed shows as refilled until the next fetch. Fetch latest still uses the forced rate-limit read, then refetches the pools.
- The card reads `GET /fellowship-logs/import-cost-estimate` and shows the exact latest import cost with its user and application split, says when the latest import was fully cached, and shows the personal range only once ten comparable imports exist. It explains that a lookup can spend points and labels its arithmetic as an example, not an average.
- A disclosure lists the official beta hourly limits by subscription, the October 20, 2026 effective date, the beta disclaimer, and the source link, all from `FELLOWSHIP_LOGS_BETA_POINT_POLICY`.
- Looking up a run is blocked by the pools that matter for the active profile: the user pool or a missing shared hold point for the recommended profile, the client pool for Use my own API client, and both pools for Use my own client and sign in. The message names the empty pool and the earliest reset. A rate-limit error from a lookup or refresh uses its reason the same way.
- Waiting import jobs explain their reason. Quota waits say which pool is empty and when the job resumes, with the clock time. Condition waits point to the action in the Connection card: connect, sign in again, allow local encryption, or opt in. Queued jobs behind a paused one say so instead of claiming points ran out. A held job does not pause the queue, so it never triggers that message.
- A job held after a connection change offers Continue with current connection. It is confirmed in place in a labelled alert dialog that names the current connection, says what it spends from now on, and says the job's points won't count toward the cost estimate. Declining returns focus to the trigger. While disconnected, the job asks for a connection instead. A job that is no longer held reports that.
- Connection changes, job transitions, and refreshes invalidate the pools and estimate.
- Unit tests cover the pool labels per profile, the import gate per profile, reset expiry, the estimate copy, and every waiting reason. Browser tests cover the Points card loading and failure isolation, and the resume confirmation, its focus return, the not-held error, and the disconnected case.

Open for 6.2:

- The database pool has no known role per profile, so it is shown without a note.
- The card was checked in component tests, not in the Electron app against live point data.

Slice 6.3's cleanup is complete:

- Settings no longer has client ID, client secret, or Test connection controls, or the rate-limit display. Its form, schema, and API response dropped the credential fields.
- The consolidated initial main schema omits the legacy `fellowship_logs_credential` table, and its DAO, model, and AppSettingsStore credential code are gone.
- No read-only Settings summary was added. The Fellowship Logs page is the only place for connection setup and status.

Open for 6.3:

- The keyboard, focus-return, browser-return, error, and screen-reader checks have not been run.

## Page structure

Place a Fellowship Logs connection section directly below the page header. Settings contains no client ID, client secret, or Test Connection controls, and no Fellowship Logs summary.

Always render local cache analytics, the existing queue, and imported runs. Gate remote lookup and new imports on a usable connection.

## Unconfigured experience

Lead with three profile cards. Recommend Connect with Fellowship Logs and place both BYO profiles under an advanced choice.

For every profile, explain:

- who owns the credentials;
- whether a browser sign-in occurs;
- which point pool is spent first;
- whether fallback can spend application points;
- public versus authorized-private report access;
- what happens when quota is exhausted;
- what protection stores local secrets or tokens.

Do not show username or password fields. Launch the system browser for authorization.

"Connect with Fellowship Logs" states before sign-in that it requires opting into Fellowship Logs' new point system. It explains:

- the opt-in is a button under Web API in Fellowship Logs account settings;
- it cannot be undone without contacting Fellowship Logs support;
- it lets imports spend only the user's own points, never the app's shared allocation;
- "Use my own client and sign in" works without it.

When the connection is in point-system opt-in required, show those steps, an action that opens Fellowship Logs account settings in the system browser, and a Check again action. Imports and lookups stay unavailable until the check passes. Never offer to continue without the directive.

"Use my own client and sign in" shows its client requirements before the user starts:

- the client must be created with Public Client checked;
- its redirect URIs must include `http://127.0.0.1:47892/oauth/callback`, shown as copyable text; the app uses an ephemeral port at runtime because the provider accepts dynamic ports for that registered URI;
- a client that has a secret belongs under "Use my own API client" instead.

Fellowship Logs reports a wrong redirect registration as raw `invalid_client` JSON in the browser and never returns to the app, so a pending own-client authorization also shows these requirements and Cancel while it waits. When it ends as `Expired`, or as `Failed` with `OwnClientRejected`, show the requirements again as the recovery.

## Connected experience

Show:

- display-safe account identity when available;
- selected profile and point policy;
- active storage-protection level;
- token expiry, reauthorization requirement, or point-system opt-in requirement;
- relevant quota pools, remaining points, and reset times;
- reconnect, change connection, and disconnect actions;
- the strict-mode one-application-point dependency.

The hybrid BYO profile requires affirmative acknowledgement that user-point exhaustion can spend that client's application points.

## Quota in practice

Centralized beta copy shows official subscription quotas with the October 20, 2026 effective date, beta disclaimer, and source link.

Use concrete workflow language:

- looking up a run can spend points;
- a completed import reports its exact total workflow cost;
- cached re-imports may use zero API points;
- a personal range appears only when enough comparable local observations exist;
- illustrative arithmetic is labeled as an example, not an average.

When waiting, prefer “resumes in 37 minutes” and the reset time over a generic 429 message.

## Recovery

- When the system browser cannot be opened, offer the authorization link to copy and a field to paste the callback URL.
- Reauthorization returns the user to the pending job or import context.
- Disconnect explains that it deletes the local session only. It must not suggest that removing the app under Authorized Applications revokes access, because issued tokens keep working after removal.
- Switching during quota wait requires confirmation and explains estimate exclusion.
- Local-encryption fallback requires acknowledgement before completion.

## Relevant code

- `apps/electron/src/renderer/components/fellowship-logs/fellowship-logs-page.tsx`
- `apps/electron/src/renderer/components/fellowship-logs/fellowship-logs-points-section.tsx`
- `apps/electron/src/renderer/components/fellowship-logs/connection`
- `apps/electron/src/renderer/components/fellowship-logs/import-dungeon-run-section.tsx`
- `apps/electron/src/renderer/components/settings/settings-editor.tsx`
- `apps/electron/src/renderer/components/background-jobs`

## Complete when

- Every profile can be understood without OAuth vocabulary.
- The active spending policy is visible before and after connection.
- Disconnected users retain access to every local artifact.
- Keyboard, focus-return, browser-return, error, and screen-reader flows pass.
- Settings and the Fellowship Logs page contain no competing credential controls.
