import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/**
 * Flat config. eslint-config-next 16 already ships flat config arrays, so
 * there is no need for the eslintrc compatibility layer.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "info/**",
      "drizzle/**",
      "public/**",
      ".data/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescriptConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
