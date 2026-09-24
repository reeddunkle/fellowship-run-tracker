import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";

import {
  type ConfigurationDAOShape,
  type PersistedConfiguration,
} from "@frt/db/daos/configuration/configuration-dao.ts";
import {
  createConfigurationPersistenceRecords,
  createPersistedConfiguration,
  getMilestoneRequirementsIdentityKey,
} from "@frt/db/daos/configuration/configuration-persistence.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import {
  ConfigurationDAOError,
  ConfigurationDefinitionNotFoundError,
  ConfigurationDuplicateError,
  ConfigurationNotFoundAfterPersistError,
  ConfigurationPersistedMilestoneNotFoundError,
  ConfigurationPersistedRequirementNotFoundError,
  ConfigurationSubmittedRequirementNotFoundError,
  ConfigurationToReplaceNotFoundError,
} from "@frt/db/errors/configuration-dao-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { ConfigurationDefinitionModel } from "@frt/db/models/configuration-definition-model.ts";
import { ConfigurationModel } from "@frt/db/models/configuration-model.ts";
import { MilestoneModel } from "@frt/db/models/milestone-model.ts";
import { MilestoneRequirementModel } from "@frt/db/models/milestone-requirement-model.ts";
import { RequirementModel } from "@frt/db/models/requirement-model.ts";
import {
  type ConfigurationDefinitionId,
  ConfigurationDefinitionIdSchema,
} from "@frt/db/validation/configuration/configuration-definition-id-schema.ts";
import { type MilestoneId } from "@frt/db/validation/milestone/milestone-id-schema.ts";
import {
  type ConfigurationId,
  ConfigurationIdSchema,
} from "@frt/shared/validation/configuration/configuration-id-schema.ts";

function mapConfigurationDAOError(cause: unknown): ConfigurationDAOError {
  if (cause instanceof ConfigurationDAOError) {
    return cause;
  }

  return new ConfigurationDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

function decodeConfigurationDefinitionRows(
  rows: unknown,
): E.Effect<
  ReadonlyArray<ConfigurationDefinitionModel>,
  ConfigurationDAOError
> {
  return Schema.decodeUnknownEffect(Schema.Array(ConfigurationDefinitionModel))(
    rows,
  ).pipe(E.mapError(mapConfigurationDAOError));
}

function decodeConfigurationRows(
  rows: unknown,
): E.Effect<ReadonlyArray<ConfigurationModel>, ConfigurationDAOError> {
  return Schema.decodeUnknownEffect(Schema.Array(ConfigurationModel))(
    rows,
  ).pipe(E.mapError(mapConfigurationDAOError));
}

function decodeMilestoneRows(
  rows: unknown,
): E.Effect<ReadonlyArray<MilestoneModel>, ConfigurationDAOError> {
  return Schema.decodeUnknownEffect(Schema.Array(MilestoneModel))(rows).pipe(
    E.mapError(mapConfigurationDAOError),
  );
}

function decodeMilestoneRequirementRows(
  rows: unknown,
): E.Effect<ReadonlyArray<MilestoneRequirementModel>, ConfigurationDAOError> {
  return Schema.decodeUnknownEffect(Schema.Array(MilestoneRequirementModel))(
    rows,
  ).pipe(E.mapError(mapConfigurationDAOError));
}

function decodeRequirementRows(
  rows: unknown,
): E.Effect<ReadonlyArray<RequirementModel>, ConfigurationDAOError> {
  return Schema.decodeUnknownEffect(Schema.Array(RequirementModel))(rows).pipe(
    E.mapError(mapConfigurationDAOError),
  );
}

export const makeConfigurationDAO = E.gen(function* () {
  const sql = yield* MainDatabase;

  const getConfigurationDefinitionById = (
    id: ConfigurationDefinitionId,
  ): E.Effect<
    Option.Option<ConfigurationDefinitionModel>,
    ConfigurationDAOError
  > => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          dungeon_id,
          dungeon_level,
          fingerprint,
          canonical_json,
          created_at,
          updated_at
        FROM
          configuration_definition
        WHERE
          id = ${id}
        LIMIT
          1
      `;

      const definitions = yield* decodeConfigurationDefinitionRows(rows);
      const definition = definitions[0];

      return definition === undefined
        ? Option.none<ConfigurationDefinitionModel>()
        : Option.some(definition);
    }).pipe(E.mapError(mapConfigurationDAOError));
  };

  const getMilestonesByConfigurationId = (
    configurationId: ConfigurationId,
  ): E.Effect<ReadonlyArray<MilestoneModel>, ConfigurationDAOError> => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          configuration_id,
          label,
          comparison_time,
          created_at,
          updated_at
        FROM
          milestone
        WHERE
          configuration_id = ${configurationId}
      `;

      return yield* decodeMilestoneRows(rows);
    }).pipe(E.mapError(mapConfigurationDAOError));
  };

  const getRequirementsByConfigurationDefinitionId = (
    configurationDefinitionId: ConfigurationDefinitionId,
  ): E.Effect<ReadonlyArray<RequirementModel>, ConfigurationDAOError> => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          configuration_definition_id,
          type,
          target_id,
          start_occurrence,
          required_count,
          created_at,
          updated_at
        FROM
          requirement
        WHERE
          configuration_definition_id = ${configurationDefinitionId}
      `;

      return yield* decodeRequirementRows(rows);
    }).pipe(E.mapError(mapConfigurationDAOError));
  };

  const getMilestoneRequirementsByMilestoneIds = (
    milestoneIds: ReadonlyArray<MilestoneId>,
  ): E.Effect<
    ReadonlyArray<MilestoneRequirementModel>,
    ConfigurationDAOError
  > => {
    if (milestoneIds.length === 0) {
      return E.succeed([]);
    }

    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          milestone_id,
          requirement_id,
          created_at
        FROM
          milestone_requirement
        WHERE
          milestone_id IN ${sql.in(milestoneIds)}
      `;

      return yield* decodeMilestoneRequirementRows(rows);
    }).pipe(E.mapError(mapConfigurationDAOError));
  };

  const hydrateConfiguration = (
    configuration: ConfigurationModel,
  ): E.Effect<PersistedConfiguration, ConfigurationDAOError> => {
    return E.gen(function* () {
      const definition = yield* getConfigurationDefinitionById(
        configuration.configurationDefinitionId,
      );

      if (Option.isNone(definition)) {
        return yield* new ConfigurationDAOError({
          reason: new ConfigurationDefinitionNotFoundError({
            configurationDefinitionId: configuration.configurationDefinitionId,
          }),
        });
      }

      const milestones = yield* getMilestonesByConfigurationId(
        configuration.id,
      );

      const requirements = yield* getRequirementsByConfigurationDefinitionId(
        definition.value.id,
      );

      const milestoneRequirements =
        yield* getMilestoneRequirementsByMilestoneIds(
          milestones.map((milestone) => {
            return milestone.id;
          }),
        );

      return yield* createPersistedConfiguration({
        configuration,
        configurationDefinition: definition.value,
        milestoneRequirements,
        milestones,
        requirements,
      }).pipe(E.mapError(mapConfigurationDAOError));
    });
  };

  const getById: ConfigurationDAOShape["getById"] = ({ id }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          configuration_definition_id,
          label,
          fingerprint,
          canonical_json,
          created_at,
          updated_at
        FROM
          configuration
        WHERE
          id = ${id}
        LIMIT
          1
      `;

      const configurations = yield* decodeConfigurationRows(rows);
      const configuration = configurations[0];

      if (configuration === undefined) {
        return Option.none<PersistedConfiguration>();
      }

      return Option.some(yield* hydrateConfiguration(configuration));
    }).pipe(E.mapError(mapConfigurationDAOError));
  };

  const getAll: ConfigurationDAOShape["getAll"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          configuration_definition_id,
          label,
          fingerprint,
          canonical_json,
          created_at,
          updated_at
        FROM
          configuration
        ORDER BY
          created_at
      `;

      const configurations = yield* decodeConfigurationRows(rows);
      const persistedConfigurations: Array<PersistedConfiguration> = [];

      for (const configuration of configurations) {
        persistedConfigurations.push(
          yield* hydrateConfiguration(configuration),
        );
      }

      return persistedConfigurations;
    }).pipe(E.mapError(mapConfigurationDAOError));
  };

  const getPersistedConfiguration = (
    id: ConfigurationId,
  ): E.Effect<PersistedConfiguration, ConfigurationDAOError> => {
    return E.gen(function* () {
      const persisted = yield* getById({ id });

      if (Option.isNone(persisted)) {
        return yield* new ConfigurationDAOError({
          reason: new ConfigurationNotFoundAfterPersistError({
            configurationId: id,
          }),
        });
      }

      return persisted.value;
    });
  };

  const persistConfiguration = ({
    configuration,
    label,
    replaceConfigurationId,
    replaceDungeonAndLevel,
  }: {
    readonly configuration: Parameters<
      ConfigurationDAOShape["save"]
    >[0]["configuration"];
    readonly label: Parameters<ConfigurationDAOShape["save"]>[0]["label"];
    readonly replaceConfigurationId?: ConfigurationId;
    readonly replaceDungeonAndLevel: boolean;
  }): E.Effect<PersistedConfiguration, ConfigurationDAOError> => {
    return E.gen(function* () {
      const records = yield* createConfigurationPersistenceRecords({
        configuration,
        label,
      }).pipe(E.mapError(mapConfigurationDAOError));

      const definitionInsert = yield* Schema.encodeEffect(
        ConfigurationDefinitionModel.insert,
      )(records.configurationDefinition).pipe(
        E.mapError(mapConfigurationDAOError),
      );

      const configurationInsert = yield* Schema.encodeEffect(
        ConfigurationModel.insert,
      )(records.configuration).pipe(E.mapError(mapConfigurationDAOError));

      const requirementRecords = yield* E.forEach(
        records.requirements,
        (requirement) => {
          return Schema.encodeEffect(RequirementModel.insert)(requirement).pipe(
            E.map((insert) => {
              return {
                insert,
                model: requirement,
              };
            }),
          );
        },
      ).pipe(E.mapError(mapConfigurationDAOError));

      const milestoneRecords = yield* E.forEach(
        records.milestones,
        (milestone) => {
          return Schema.encodeEffect(MilestoneModel.insert)(milestone).pipe(
            E.map((insert) => {
              return {
                insert,
                model: milestone,
              };
            }),
          );
        },
      ).pipe(E.mapError(mapConfigurationDAOError));

      const milestoneRequirementRecords = yield* E.forEach(
        records.milestoneRequirements,
        (milestoneRequirement) => {
          return Schema.encodeEffect(MilestoneRequirementModel.insert)(
            milestoneRequirement,
          ).pipe(
            E.map((insert) => {
              return {
                insert,
                model: milestoneRequirement,
              };
            }),
          );
        },
      ).pipe(E.mapError(mapConfigurationDAOError));

      const requirementsById = R.fromIterableBy(
        records.requirements,
        (requirement) => {
          return requirement.id;
        },
      );

      const milestoneRequirementRecordsByMilestoneId =
        milestoneRequirementRecords.reduce<
          Record<string, Array<(typeof milestoneRequirementRecords)[number]>>
        >((groups, milestoneRequirementRecord) => {
          const milestoneId = milestoneRequirementRecord.model.milestoneId;
          const existingRecords = groups[milestoneId];

          if (existingRecords === undefined) {
            groups[milestoneId] = [milestoneRequirementRecord];
          } else {
            existingRecords.push(milestoneRequirementRecord);
          }

          return groups;
        }, {});

      const configurationId = yield* sql
        .withTransaction(
          E.gen(function* () {
            if (replaceConfigurationId !== undefined) {
              const rows = yield* sql`
                SELECT
                  id
                FROM
                  configuration
                WHERE
                  id = ${replaceConfigurationId}
                LIMIT
                  1
              `;

              if (rows[0] === undefined) {
                return yield* new ConfigurationDAOError({
                  reason: new ConfigurationToReplaceNotFoundError({
                    configurationId: replaceConfigurationId,
                  }),
                });
              }
            }

            const definitionRows = yield* sql`
              SELECT
                id
              FROM
                configuration_definition
              WHERE
                fingerprint = ${definitionInsert.fingerprint}
              LIMIT
                1
            `;

            const existingDefinition = definitionRows[0];

            const configurationDefinitionId =
              existingDefinition === undefined
                ? records.configurationDefinition.id
                : yield* Schema.decodeUnknownEffect(
                    ConfigurationDefinitionIdSchema,
                  )(existingDefinition.id).pipe(
                    E.mapError(mapConfigurationDAOError),
                  );

            if (existingDefinition === undefined) {
              yield* sql`
                INSERT INTO
                  configuration_definition (
                    id,
                    dungeon_id,
                    dungeon_level,
                    fingerprint,
                    canonical_json,
                    created_at,
                    updated_at
                  )
                VALUES
                  (
                    ${definitionInsert.id},
                    ${definitionInsert.dungeonId},
                    ${definitionInsert.dungeonLevel},
                    ${definitionInsert.fingerprint},
                    ${definitionInsert.canonicalJson},
                    ${definitionInsert.createdAt},
                    ${definitionInsert.updatedAt}
                  )
              `;

              yield* E.forEach(
                requirementRecords,
                ({ insert: requirementInsert }) => {
                  return sql`
                    INSERT INTO
                      requirement (
                        id,
                        configuration_definition_id,
                        type,
                        target_id,
                        start_occurrence,
                        required_count,
                        created_at,
                        updated_at
                      )
                    VALUES
                      (
                        ${requirementInsert.id},
                        ${configurationDefinitionId},
                        ${requirementInsert.type},
                        ${requirementInsert.targetId},
                        ${requirementInsert.startOccurrence},
                        ${requirementInsert.requiredCount},
                        ${requirementInsert.createdAt},
                        ${requirementInsert.updatedAt}
                      )
                  `;
                },
                {
                  discard: true,
                },
              );
            }

            const duplicateRows = yield* sql`
              SELECT
                id
              FROM
                configuration
              WHERE
                fingerprint = ${configurationInsert.fingerprint}
              LIMIT
                1
            `;

            const duplicateConfiguration = duplicateRows[0];

            if (duplicateConfiguration !== undefined) {
              const duplicateConfigurationId =
                yield* Schema.decodeUnknownEffect(ConfigurationIdSchema)(
                  duplicateConfiguration.id,
                ).pipe(E.mapError(mapConfigurationDAOError));

              if (duplicateConfigurationId !== replaceConfigurationId) {
                return yield* new ConfigurationDAOError({
                  reason: new ConfigurationDuplicateError({
                    configurationId: duplicateConfigurationId,
                  }),
                });
              }

              yield* sql`
                UPDATE configuration
                SET
                  label = ${configurationInsert.label},
                  updated_at = ${configurationInsert.updatedAt}
                WHERE
                  id = ${duplicateConfigurationId}
              `;

              const existingMilestones = yield* getMilestonesByConfigurationId(
                duplicateConfigurationId,
              );

              const existingRequirements =
                yield* getRequirementsByConfigurationDefinitionId(
                  configurationDefinitionId,
                );

              const existingMilestoneRequirements =
                yield* getMilestoneRequirementsByMilestoneIds(
                  existingMilestones.map((milestone) => {
                    return milestone.id;
                  }),
                );

              const existingRequirementsById = R.fromIterableBy(
                existingRequirements,
                (requirement) => {
                  return requirement.id;
                },
              );

              const existingMilestoneRequirementsByMilestoneId =
                existingMilestoneRequirements.reduce<
                  Record<
                    string,
                    Array<(typeof existingMilestoneRequirements)[number]>
                  >
                >((groups, milestoneRequirement) => {
                  const milestoneId = milestoneRequirement.milestoneId;
                  const existingRecords = groups[milestoneId];

                  if (existingRecords === undefined) {
                    groups[milestoneId] = [milestoneRequirement];
                  } else {
                    existingRecords.push(milestoneRequirement);
                  }

                  return groups;
                }, {});

              const existingMilestonesByIdentityKey = R.fromIterableBy(
                existingMilestones,
                (milestone) => {
                  const milestoneRequirements =
                    existingMilestoneRequirementsByMilestoneId[milestone.id] ??
                    [];

                  const requirements = milestoneRequirements.flatMap(
                    (milestoneRequirement) => {
                      const requirement =
                        existingRequirementsById[
                          milestoneRequirement.requirementId
                        ];

                      return requirement === undefined ? [] : [requirement];
                    },
                  );

                  return getMilestoneRequirementsIdentityKey(requirements);
                },
              );

              yield* E.forEach(
                milestoneRecords,
                ({ insert: milestoneInsert, model: milestone }) => {
                  const submittedMilestoneRequirements =
                    milestoneRequirementRecordsByMilestoneId[milestone.id] ??
                    [];

                  const submittedRequirements =
                    submittedMilestoneRequirements.flatMap(
                      ({ model: milestoneRequirement }) => {
                        const requirement =
                          requirementsById[milestoneRequirement.requirementId];

                        return requirement === undefined ? [] : [requirement];
                      },
                    );

                  const submittedIdentityKey =
                    getMilestoneRequirementsIdentityKey(submittedRequirements);

                  const existingMilestone =
                    existingMilestonesByIdentityKey[submittedIdentityKey];

                  if (existingMilestone === undefined) {
                    return new ConfigurationDAOError({
                      reason: new ConfigurationPersistedMilestoneNotFoundError({
                        configurationId: duplicateConfigurationId,
                      }),
                    });
                  }

                  return sql`
                    UPDATE milestone
                    SET
                      comparison_time = ${milestoneInsert.comparisonTime},
                      label = ${milestoneInsert.label},
                      updated_at = ${milestoneInsert.updatedAt}
                    WHERE
                      id = ${existingMilestone.id}
                  `.pipe(E.mapError(mapConfigurationDAOError));
                },
                {
                  discard: true,
                },
              );

              return duplicateConfigurationId;
            }

            const newConfigurationId = records.configuration.id;

            yield* sql`
              INSERT INTO
                configuration (
                  id,
                  configuration_definition_id,
                  label,
                  fingerprint,
                  canonical_json,
                  created_at,
                  updated_at
                )
              VALUES
                (
                  ${newConfigurationId},
                  ${configurationDefinitionId},
                  ${configurationInsert.label},
                  ${configurationInsert.fingerprint},
                  ${configurationInsert.canonicalJson},
                  ${configurationInsert.createdAt},
                  ${configurationInsert.updatedAt}
                )
            `;

            const persistedRequirements =
              yield* getRequirementsByConfigurationDefinitionId(
                configurationDefinitionId,
              );

            const persistedRequirementsByIdentityKey = R.fromIterableBy(
              persistedRequirements,
              (requirement) => {
                return getMilestoneRequirementsIdentityKey([requirement]);
              },
            );

            yield* E.forEach(
              milestoneRecords,
              ({ insert: milestoneInsert, model: milestone }) => {
                return E.gen(function* () {
                  yield* sql`
                    INSERT INTO
                      milestone (
                        id,
                        configuration_id,
                        label,
                        comparison_time,
                        created_at,
                        updated_at
                      )
                    VALUES
                      (
                        ${milestoneInsert.id},
                        ${newConfigurationId},
                        ${milestoneInsert.label},
                        ${milestoneInsert.comparisonTime},
                        ${milestoneInsert.createdAt},
                        ${milestoneInsert.updatedAt}
                      )
                  `;

                  const submittedMilestoneRequirements =
                    milestoneRequirementRecordsByMilestoneId[milestone.id] ??
                    [];

                  yield* E.forEach(
                    submittedMilestoneRequirements,
                    ({
                      insert: milestoneRequirementInsert,
                      model: milestoneRequirement,
                    }) => {
                      const submittedRequirement =
                        requirementsById[milestoneRequirement.requirementId];

                      if (submittedRequirement === undefined) {
                        return new ConfigurationDAOError({
                          reason:
                            new ConfigurationSubmittedRequirementNotFoundError({
                              requirementId: milestoneRequirement.requirementId,
                            }),
                        });
                      }

                      const requirementIdentity =
                        getMilestoneRequirementsIdentityKey([
                          submittedRequirement,
                        ]);

                      const persistedRequirement =
                        persistedRequirementsByIdentityKey[requirementIdentity];

                      if (persistedRequirement === undefined) {
                        return new ConfigurationDAOError({
                          reason:
                            new ConfigurationPersistedRequirementNotFoundError({
                              milestoneId: milestone.id,
                            }),
                        });
                      }

                      return sql`
                        INSERT INTO
                          milestone_requirement (milestone_id, requirement_id, created_at)
                        VALUES
                          (
                            ${milestoneInsert.id},
                            ${persistedRequirement.id},
                            ${milestoneRequirementInsert.createdAt}
                          )
                      `.pipe(E.mapError(mapConfigurationDAOError));
                    },
                    {
                      discard: true,
                    },
                  );
                });
              },
              {
                discard: true,
              },
            );

            if (
              replaceConfigurationId !== undefined &&
              replaceConfigurationId !== newConfigurationId
            ) {
              yield* sql`
                DELETE FROM configuration
                WHERE
                  id = ${replaceConfigurationId}
              `;
            }

            if (replaceDungeonAndLevel) {
              yield* sql`
                DELETE FROM configuration
                WHERE
                  id IN (
                    SELECT
                      configuration.id
                    FROM
                      configuration
                      INNER JOIN configuration_definition ON configuration_definition.id = configuration.configuration_definition_id
                    WHERE
                      configuration_definition.dungeon_id = ${definitionInsert.dungeonId}
                      AND configuration_definition.dungeon_level = ${definitionInsert.dungeonLevel}
                      AND configuration.id <> ${newConfigurationId}
                  )
              `;
            }

            return newConfigurationId;
          }),
        )
        .pipe(E.mapError(mapConfigurationDAOError));

      return yield* getPersistedConfiguration(configurationId);
    });
  };

  const save: ConfigurationDAOShape["save"] = ({ configuration, label }) => {
    return persistConfiguration({
      configuration,
      label,
      replaceDungeonAndLevel: false,
    });
  };

  const saveReplacingDungeonAndLevel: ConfigurationDAOShape["saveReplacingDungeonAndLevel"] =
    ({ configuration, label }) => {
      return persistConfiguration({
        configuration,
        label,
        replaceDungeonAndLevel: true,
      });
    };

  const update: ConfigurationDAOShape["update"] = ({
    configuration,
    id,
    label,
  }) => {
    return persistConfiguration({
      configuration,
      label,
      replaceConfigurationId: id,
      replaceDungeonAndLevel: false,
    });
  };

  const deleteConfiguration: ConfigurationDAOShape["delete"] = ({ id }) => {
    return sql`
      DELETE FROM configuration
      WHERE
        id = ${id}
    `.pipe(E.asVoid, E.mapError(mapConfigurationDAOError));
  };

  const deleteByDungeonAndLevel: ConfigurationDAOShape["deleteByDungeonAndLevel"] =
    ({ dungeonId, dungeonLevel }) => {
      return sql`
        DELETE FROM configuration
        WHERE
          id IN (
            SELECT
              configuration.id
            FROM
              configuration
              INNER JOIN configuration_definition ON configuration_definition.id = configuration.configuration_definition_id
            WHERE
              configuration_definition.dungeon_id = ${dungeonId}
              AND configuration_definition.dungeon_level = ${dungeonLevel}
          )
      `.pipe(E.asVoid, E.mapError(mapConfigurationDAOError));
    };

  return {
    delete: deleteConfiguration,
    deleteByDungeonAndLevel,
    getAll,
    getById,
    save,
    saveReplacingDungeonAndLevel,
    update,
  } satisfies ConfigurationDAOShape;
});
