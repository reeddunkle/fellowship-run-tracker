import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { ConfigurationLibrary } from "@frt/api/services/configuration-library/configuration-library-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { type ConfigurationDAOError } from "@frt/db/errors/configuration-dao-error.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

function mapConfigurationError(
  error: ConfigurationDAOError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Configuration persistence operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

const ConfigurationsApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "configurations",
  E.fn(function* (handlers) {
    const configurationLibrary = yield* ConfigurationLibrary;

    return handlers
      .handle("getConfigurations", () => {
        return configurationLibrary
          .getAll()
          .pipe(E.catch(mapConfigurationError));
      })
      .handle("getConfiguration", ({ params }) => {
        return E.gen(function* () {
          const configuration = yield* configurationLibrary
            .getById({
              id: params.id,
            })
            .pipe(E.catch(mapConfigurationError));

          if (Option.isNone(configuration)) {
            return yield* new HttpApiError.NotFound();
          }

          return configuration.value;
        });
      })
      .handle("saveConfiguration", ({ payload }) => {
        const configuration = {
          dungeonId: payload.configuration.dungeonId,
          dungeonLevel: payload.configuration.dungeonLevel,
          milestones: payload.configuration.milestones,
        } satisfies FellowshipMilestoneConfiguration;

        return configurationLibrary
          .save({
            configuration,
            label: payload.label,
          })
          .pipe(E.catch(mapConfigurationError));
      })
      .handle("saveReplacingDungeonAndLevel", ({ payload }) => {
        const configuration = {
          dungeonId: payload.configuration.dungeonId,
          dungeonLevel: payload.configuration.dungeonLevel,
          milestones: payload.configuration.milestones,
        } satisfies FellowshipMilestoneConfiguration;

        return configurationLibrary
          .saveReplacingDungeonAndLevel({
            configuration,
            label: payload.label,
          })
          .pipe(E.catch(mapConfigurationError));
      })
      .handle("updateConfiguration", ({ params, payload }) => {
        const configuration = {
          dungeonId: payload.configuration.dungeonId,
          dungeonLevel: payload.configuration.dungeonLevel,
          milestones: payload.configuration.milestones,
        } satisfies FellowshipMilestoneConfiguration;

        return configurationLibrary
          .update({
            configuration,
            id: params.id,
            label: payload.label,
          })
          .pipe(E.catch(mapConfigurationError));
      })
      .handle("deleteConfiguration", ({ params }) => {
        return configurationLibrary
          .delete({
            id: params.id,
          })
          .pipe(E.catch(mapConfigurationError));
      })
      .handle("deleteConfigurationsByDungeonAndLevel", ({ payload }) => {
        return configurationLibrary
          .deleteByDungeonAndLevel({
            dungeonId: payload.dungeonId,
            dungeonLevel: payload.dungeonLevel,
          })
          .pipe(E.catch(mapConfigurationError));
      });
  }),
);

export const ConfigurationsApiLayer: Layer.Layer<
  Layer.Success<typeof ConfigurationsApiHandlersInferred>,
  Layer.Error<typeof ConfigurationsApiHandlersInferred>,
  ConfigurationLibrary
> = ConfigurationsApiHandlersInferred;
