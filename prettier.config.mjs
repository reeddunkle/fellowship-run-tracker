/** @type {import("prettier").Config} */
const prettierConfig = {
  plugins: ["prettier-plugin-embed", "prettier-plugin-sql"],
};

/** @type {import("prettier-plugin-embed").PrettierPluginEmbedOptions} */
const prettierPluginEmbedConfig = {
  embeddedSqlTags: ["sql"],
};

/** @type {import("prettier-plugin-sql").SqlBaseOptions} */
const prettierPluginSqlConfig = {
  indentStyle: "standard",
  keywordCase: "upper",
  language: "sqlite",
};

export default {
  ...prettierConfig,
  ...prettierPluginEmbedConfig,
  ...prettierPluginSqlConfig,
};
