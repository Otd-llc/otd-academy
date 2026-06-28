import next from "eslint-config-next";

// Flat config (ESLint 10 / eslint-config-next 16). The package exports ready-made
// flat-config arrays, so spread the recommended set directly — no FlatCompat shim.
const eslintConfig = [
  {
    // one-off scripts (CLI tools / seeds) and generated/vendored trees are out of
    // scope for the app lint baseline.
    ignores: [
      ".next/**",
      "node_modules/**",
      ".claude/**",
      "public/**",
      "scripts/**",
      "coverage/**",
      "next-env.d.ts",
      "*.config.*",
    ],
  },
  ...next,
];

export default eslintConfig;
