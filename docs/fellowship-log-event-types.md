# Fellowship combat log event types

Every event type that appears in a Fellowship combat log. The app parses only the types marked "Yes", which are the ones in `FELLOWSHIP_EVENT` (`packages/shared/src/fellowship/constants/fellowship-event.ts`).

| Event type | Parsed |
| --- | --- |
| `ABILITY_ACTIVATED` | Yes |
| `ABILITY_CAST_FAIL` | No |
| `ABILITY_CAST_START` | No |
| `ABILITY_CAST_SUCCESS` | No |
| `ABILITY_CHANNEL_FAIL` | No |
| `ABILITY_CHANNEL_START` | No |
| `ABILITY_CHANNEL_SUCCESS` | No |
| `ABILITY_DAMAGE` | No |
| `ABILITY_DISPEL` | No |
| `ABILITY_HEAL` | No |
| `ABILITY_INTERRUPT` | No |
| `ABILITY_PERIODIC_DAMAGE` | No |
| `ABILITY_PERIODIC_HEAL` | No |
| `ALLY_DEATH` | No |
| `COMBATANT_INFO` | No |
| `DAMAGE_ABSORBED` | No |
| `DUNGEON_END` | Yes |
| `DUNGEON_START` | Yes |
| `EFFECT_APPLIED` | No |
| `EFFECT_REFRESHED` | No |
| `EFFECT_REMOVED` | No |
| `ENCOUNTER_END` | Yes |
| `ENCOUNTER_START` | Yes |
| `LOGGING_STARTED` | Yes |
| `MAP_CHANGE` | Yes |
| `MARKER_PLACED` | No |
| `MARKER_REMOVED` | No |
| `RESOURCE_CHANGED` | No |
| `SWING_DAMAGE` | No |
| `UNIT_DEATH` | Yes |
| `UNIT_DESTROYED` | Yes |
| `WORLD_MARKER_PLACED` | No |
| `WORLD_MARKER_REMOVED` | No |
| `ZONE_CHANGE` | Yes |
