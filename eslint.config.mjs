import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next. These are ROOT-anchored: `.next/**`
    // does not match `somewhere/else/.next/**`, which is why the nested globs
    // below are separate entries rather than duplicates of these.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output ANYWHERE, not only at the root. Agent worktrees under
    // `.claude/worktrees/` are full checkouts and each carries its own `.next`,
    // so a root-anchored ignore let eslint walk into generated bundles: 46,582
    // problems and 2,364 errors from machine-written code, none of it ours, and
    // a lint gate that took minutes and exited 1 on a clean tree. They are
    // gitignored via .git/info/exclude, which eslint does not read.
    "**/.next/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
