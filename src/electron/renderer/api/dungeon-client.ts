import * as E from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { getApiBaseUrl } from "@/electron/renderer/api/api-url.ts";

// type DungeonIdArgs = {
//   readonly id: string;
// };

function makeHttpApiClient(baseUrl: string) {
  return HttpApiClient.make(AppHttpApi, {
    baseUrl,
  });
}

function getDungeonsBase(baseUrl: string) {
  return () => {
    return E.gen(function* () {
      const client = yield* makeHttpApiClient(baseUrl);

      return yield* client.dungeons.getDungeons();
    });
  };
}

// function getDungeonBase(baseUrl: string) {
//   return ({ id }: DungeonIdArgs) => {
//     return E.gen(function* () {
//       const client = yield* makeHttpApiClient(baseUrl);

//       return yield* client.dungeons.getDungeon({
//         params: {
//           id,
//         },
//       });
//     });
//   };
// }

export function getDungeons() {
  return getDungeonsBase(getApiBaseUrl())();
}

// function getDungeon(args: DungeonIdArgs) {
//   return getDungeonBase(getApiBaseUrl())(args);
// }
