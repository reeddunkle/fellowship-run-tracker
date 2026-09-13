export function parseUnitId(unitId: string): {
  readonly unitInstanceId: string;
  readonly unitTypeId: string;
} {
  const segments = unitId.split("-");
  const unitTypeId = segments.at(-1);
  const unitInstanceId = segments.at(-2);

  if (unitInstanceId === undefined || unitTypeId === undefined) {
    return {
      unitInstanceId: unitId,
      unitTypeId: "0",
    };
  }

  return {
    unitInstanceId,
    unitTypeId,
  };
}
