export function makeQuery({
  name,
  selections,
  variables,
}: {
  readonly name?: string;
  readonly selections: ReadonlyArray<string>;
  readonly variables?: ReadonlyArray<string>;
}) {
  const operationName = name === undefined ? "" : ` ${name}`;
  const variableDefinitions =
    variables === undefined || variables.length === 0
      ? ""
      : `(
        ${variables.join("\n")}
      )`;

  return `
    query${operationName}${variableDefinitions} {
      ${selections.join("\n")}
    }
  `;
}
