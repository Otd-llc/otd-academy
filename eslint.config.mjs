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
  {
    rules: {
      // `// text` is a deliberate code-comment-style eyebrow motif across the UI
      // ("// LINK SENT", "// {heading}"); it's rendered text, not a forgotten
      // comment, and the rule can't tell them apart.
      "react/jsx-no-comment-textnodes": "off",
      // literal apostrophes / quotes in copy render fine; escaping them is noise.
      "react/no-unescaped-entities": "off",
      // advisory perf rule (cascading renders from prop->state sync), not a
      // correctness bug — surface as a warning to track, don't block.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
