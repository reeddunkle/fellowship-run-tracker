import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { type BackgroundJobDAOShape } from "@frt/db/daos/background-job/background-job-dao.ts";
import { BackgroundJobDAOError } from "@frt/db/errors/background-job-dao-error.ts";
import {
  BackgroundJobNotFoundError,
  BackgroundJobNotReturnedAfterInsertError,
} from "@frt/db/errors/background-job-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import { BackgroundJobFailureSchema } from "@frt/shared/validation/background-job/background-job-failure-schema.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

const BackgroundJobFailureFromJsonString = Schema.fromJsonString(
  BackgroundJobFailureSchema,
);

const JsonFromString = Schema.fromJsonString(Schema.Json);

const NextAvailableAtRowSchema = Schema.Struct({
  availableAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
});

function mapBackgroundJobDAOError(cause: unknown): BackgroundJobDAOError {
  if (cause instanceof BackgroundJobDAOError) {
    return cause;
  }

  return new BackgroundJobDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

function makeJobNotFoundError(id: BackgroundJobId): BackgroundJobDAOError {
  return new BackgroundJobDAOError({
    reason: new BackgroundJobNotFoundError({ id }),
  });
}

function decodeBackgroundJobRows(
  rows: unknown,
): E.Effect<ReadonlyArray<BackgroundJobModel>, BackgroundJobDAOError> {
  return Schema.decodeUnknownEffect(Schema.Array(BackgroundJobModel))(
    rows,
  ).pipe(E.mapError(mapBackgroundJobDAOError));
}

const encodeNow = DateTime.now.pipe(
  E.flatMap(Schema.encodeEffect(Schema.DateTimeUtcFromMillis)),
  E.mapError(mapBackgroundJobDAOError),
);

export const makeBackgroundJobDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const columns = sql.literal(`
    id,
    queue,
    kind,
    payload,
    status,
    idempotency_key,
    available_at,
    attempts,
    error,
    result,
    started_at,
    finished_at,
    created_at,
    updated_at
  `);

  const getById: BackgroundJobDAOShape["getById"] = ({ id }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          ${columns}
        FROM
          background_job
        WHERE
          id = ${id}
        LIMIT
          1
      `;

      const jobs = yield* decodeBackgroundJobRows(rows);

      return Option.fromUndefinedOr(jobs[0]);
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const getActiveByIdempotencyKey = ({
    idempotencyKey,
    queue,
  }: {
    readonly idempotencyKey: string;
    readonly queue: string;
  }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          ${columns}
        FROM
          background_job
        WHERE
          queue = ${queue}
          AND idempotency_key = ${idempotencyKey}
          AND status IN ('QUEUED', 'WAITING', 'RUNNING')
        LIMIT
          1
      `;

      const jobs = yield* decodeBackgroundJobRows(rows);

      return Option.fromUndefinedOr(jobs[0]);
    });
  };

  const insert: BackgroundJobDAOShape["insert"] = ({
    idempotencyKey,
    kind,
    payload,
    queue,
  }) => {
    return E.gen(function* () {
      const job = BackgroundJobModel.insert.make({
        attempts: 0,
        availableAt: null,
        error: null,
        finishedAt: null,
        idempotencyKey,
        kind,
        payload,
        queue,
        result: null,
        startedAt: null,
        status: "QUEUED",
      });

      const encoded = yield* Schema.encodeEffect(BackgroundJobModel.insert)(
        job,
      );

      // The partial unique index on (queue, idempotency_key) makes this a
      // no-op when an equivalent job is already queued or running.
      const rows = yield* sql`
        INSERT INTO
          background_job (
            id,
            queue,
            kind,
            payload,
            status,
            idempotency_key,
            available_at,
            attempts,
            error,
            result,
            started_at,
            finished_at,
            created_at,
            updated_at
          )
        VALUES
          (
            ${encoded.id},
            ${encoded.queue},
            ${encoded.kind},
            ${encoded.payload},
            ${encoded.status},
            ${encoded.idempotencyKey},
            ${encoded.availableAt},
            ${encoded.attempts},
            ${encoded.error},
            ${encoded.result},
            ${encoded.startedAt},
            ${encoded.finishedAt},
            ${encoded.createdAt},
            ${encoded.updatedAt}
          )
        ON CONFLICT DO NOTHING
        RETURNING
          ${columns}
      `;

      const inserted = (yield* decodeBackgroundJobRows(rows))[0];

      if (inserted !== undefined) {
        return { job: inserted, wasInserted: true };
      }

      const existing =
        idempotencyKey === null
          ? Option.none<BackgroundJobModel>()
          : yield* getActiveByIdempotencyKey({ idempotencyKey, queue });

      if (Option.isNone(existing)) {
        return yield* new BackgroundJobDAOError({
          reason: new BackgroundJobNotReturnedAfterInsertError({ id: job.id }),
        });
      }

      return { job: existing.value, wasInserted: false };
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const claimNext: BackgroundJobDAOShape["claimNext"] = ({
    holdWhileWaiting,
    queue,
  }) => {
    return E.gen(function* () {
      const now = yield* encodeNow;

      // Waiting jobs that are due go first, since they were already underway.
      const rows = yield* sql`
        UPDATE background_job
        SET
          status = 'RUNNING',
          attempts = attempts + 1,
          available_at = NULL,
          error = NULL,
          started_at = ${now},
          updated_at = ${now}
        WHERE
          id = (
            SELECT
              id
            FROM
              background_job
            WHERE
              queue = ${queue}
              AND (
                status = 'QUEUED'
                OR (
                  status = 'WAITING'
                  AND available_at <= ${now}
                )
              )
            ORDER BY
              status = 'WAITING' DESC,
              created_at,
              rowid
            LIMIT
              1
          )
          AND (
            ${holdWhileWaiting ? 1 : 0} = 0
            OR NOT EXISTS (
              SELECT
                1
              FROM
                background_job AS waiting
              WHERE
                waiting.queue = ${queue}
                AND waiting.status = 'WAITING'
                AND waiting.available_at > ${now}
            )
          )
        RETURNING
          ${columns}
      `;

      const jobs = yield* decodeBackgroundJobRows(rows);

      return Option.fromUndefinedOr(jobs[0]);
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const markWaiting: BackgroundJobDAOShape["markWaiting"] = ({
    availableAt,
    id,
    reason,
  }) => {
    return E.gen(function* () {
      const now = yield* encodeNow;
      const encodedAvailableAt = yield* Schema.encodeEffect(
        Schema.DateTimeUtcFromMillis,
      )(availableAt);
      const encodedReason = yield* Schema.encodeEffect(
        BackgroundJobFailureFromJsonString,
      )(reason);

      // The attempt is handed back: waiting isn't a failure, so it mustn't
      // count toward the queue's attempt limit.
      const rows = yield* sql`
        UPDATE background_job
        SET
          status = 'WAITING',
          available_at = ${encodedAvailableAt},
          attempts = MAX(attempts - 1, 0),
          error = ${encodedReason},
          started_at = NULL,
          updated_at = ${now}
        WHERE
          id = ${id}
          AND status = 'RUNNING'
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeJobNotFoundError(id);
      }
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const getNextAvailableAt: BackgroundJobDAOShape["getNextAvailableAt"] = ({
    holdWhileWaiting,
    queue,
  }) => {
    return E.gen(function* () {
      const rows = holdWhileWaiting
        ? yield* sql`
            SELECT
              MAX(available_at) AS available_at
            FROM
              background_job
            WHERE
              queue = ${queue}
              AND status = 'WAITING'
          `
        : yield* sql`
            SELECT
              MIN(available_at) AS available_at
            FROM
              background_job
            WHERE
              queue = ${queue}
              AND status = 'WAITING'
          `;

      const [row] = yield* Schema.decodeUnknownEffect(
        Schema.Array(NextAvailableAtRowSchema),
      )(rows);

      return Option.fromNullishOr(row?.availableAt);
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const markSucceeded: BackgroundJobDAOShape["markSucceeded"] = ({
    id,
    result,
  }) => {
    return E.gen(function* () {
      const now = yield* encodeNow;
      const encodedResult = yield* Schema.encodeEffect(JsonFromString)(result);

      const rows = yield* sql`
        UPDATE background_job
        SET
          status = 'SUCCEEDED',
          result = ${encodedResult},
          error = NULL,
          finished_at = ${now},
          updated_at = ${now}
        WHERE
          id = ${id}
          AND status = 'RUNNING'
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeJobNotFoundError(id);
      }
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const markFailed: BackgroundJobDAOShape["markFailed"] = ({ error, id }) => {
    return E.gen(function* () {
      const now = yield* encodeNow;
      const encodedError = yield* Schema.encodeEffect(
        BackgroundJobFailureFromJsonString,
      )(error);

      const rows = yield* sql`
        UPDATE background_job
        SET
          status = 'FAILED',
          error = ${encodedError},
          finished_at = ${now},
          updated_at = ${now}
        WHERE
          id = ${id}
          AND status = 'RUNNING'
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeJobNotFoundError(id);
      }
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const retry: BackgroundJobDAOShape["retry"] = ({ id }) => {
    return E.gen(function* () {
      const now = yield* encodeNow;

      const rows = yield* sql`
        UPDATE background_job
        SET
          status = 'QUEUED',
          attempts = 0,
          error = NULL,
          result = NULL,
          started_at = NULL,
          finished_at = NULL,
          updated_at = ${now}
        WHERE
          id = ${id}
          AND status = 'FAILED'
          AND NOT EXISTS (
            SELECT
              1
            FROM
              background_job AS active
            WHERE
              active.queue = background_job.queue
              AND active.idempotency_key = background_job.idempotency_key
              AND active.status IN ('QUEUED', 'WAITING', 'RUNNING')
          )
        RETURNING
          ${columns}
      `;

      const job = (yield* decodeBackgroundJobRows(rows))[0];

      if (job === undefined) {
        return yield* makeJobNotFoundError(id);
      }

      return job;
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const delete_: BackgroundJobDAOShape["delete"] = ({ id, statuses }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        DELETE FROM background_job
        WHERE
          id = ${id}
          AND status IN ${sql.in(statuses)}
        RETURNING
          id
      `;

      if (rows[0] === undefined) {
        return yield* makeJobNotFoundError(id);
      }
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const deleteFinishedBefore: BackgroundJobDAOShape["deleteFinishedBefore"] = ({
    finishedBefore,
    queues,
    statuses,
  }) => {
    return E.gen(function* () {
      const encodedFinishedBefore = yield* Schema.encodeEffect(
        Schema.DateTimeUtcFromMillis,
      )(finishedBefore);

      const rows =
        queues === undefined
          ? yield* sql`
              DELETE FROM background_job
              WHERE
                status IN ${sql.in(statuses)}
                AND finished_at < ${encodedFinishedBefore}
              RETURNING
                id
            `
          : yield* sql`
              DELETE FROM background_job
              WHERE
                status IN ${sql.in(statuses)}
                AND queue IN ${sql.in(queues)}
                AND finished_at < ${encodedFinishedBefore}
              RETURNING
                id
            `;

      return rows.length;
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const list: BackgroundJobDAOShape["list"] = ({ queues }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          ${columns}
        FROM
          background_job
        WHERE
          queue IN ${sql.in(queues)}
        ORDER BY
          created_at,
          rowid
      `;

      return yield* decodeBackgroundJobRows(rows);
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  const recoverRunning: BackgroundJobDAOShape["recoverRunning"] = ({
    exhaustedError,
    maxAttempts,
    queue,
  }) => {
    return E.gen(function* () {
      const now = yield* encodeNow;
      const encodedExhaustedError = yield* Schema.encodeEffect(
        BackgroundJobFailureFromJsonString,
      )(exhaustedError);

      yield* sql.withTransaction(
        E.gen(function* () {
          yield* sql`
            UPDATE background_job
            SET
              status = 'FAILED',
              error = ${encodedExhaustedError},
              finished_at = ${now},
              updated_at = ${now}
            WHERE
              queue = ${queue}
              AND status = 'RUNNING'
              AND attempts >= ${maxAttempts}
          `;

          yield* sql`
            UPDATE background_job
            SET
              status = 'QUEUED',
              started_at = NULL,
              updated_at = ${now}
            WHERE
              queue = ${queue}
              AND status = 'RUNNING'
          `;
        }),
      );
    }).pipe(E.mapError(mapBackgroundJobDAOError));
  };

  return {
    claimNext,
    delete: delete_,
    deleteFinishedBefore,
    getById,
    getNextAvailableAt,
    insert,
    list,
    markFailed,
    markSucceeded,
    markWaiting,
    recoverRunning,
    retry,
  } satisfies BackgroundJobDAOShape;
});
