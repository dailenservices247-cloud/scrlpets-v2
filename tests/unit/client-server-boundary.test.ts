import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Resolve an "@/..." import to a real file on disk, trying the usual suffixes. */
function resolveImport(spec: string, fromFile: string): string | null {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(fromFile), spec)
      : null;
  if (!base) return null;
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* not this one */
    }
  }
  return null;
}

const SERVER_ONLY = /from "next\/headers"|from "server-only"/;

/**
 * Value imports only. `import type { X } from "..."` is erased by the compiler
 * and never reaches the bundle, so it cannot cause the failure this guards.
 */
function importsOf(source: string): string[] {
  return [...source.matchAll(/^\s*import\s+([^"']*?)["']([^"']+)["']/gm)]
    .filter((m) => !/^type\s/.test(m[1].trim()))
    .map((m) => m[2]);
}

/**
 * A client component that transitively imports a server-only module builds
 * fine under tsc and fails only in the bundler. This has bitten twice — the
 * reaction constants, then formatPrice in shop/queries. Catch it in unit
 * tests instead of an e2e run.
 */
function serverOnlyChain(file: string, seen = new Set<string>()): string[] | null {
  if (seen.has(file)) return null;
  seen.add(file);
  const source = readFileSync(file, "utf8");
  // "use server" modules are the sanctioned boundary: the client gets an RPC
  // stub, not the module body, so the chain legitimately stops here.
  if (/^\s*["']use server["']/.test(source)) return null;
  if (SERVER_ONLY.test(source)) return [file];
  for (const spec of importsOf(source)) {
    const target = resolveImport(spec, file);
    if (!target) continue;
    const chain = serverOnlyChain(target, seen);
    if (chain) return [file, ...chain];
  }
  return null;
}

describe("client/server boundary", () => {
  const clientFiles = walk(SRC).filter((f) =>
    /^\s*["']use client["']/.test(readFileSync(f, "utf8")),
  );

  it("finds client components to check", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it.each(clientFiles)("%s does not reach a server-only module", (file) => {
    const chain = serverOnlyChain(file);
    expect(
      chain,
      chain ? `server-only import chain: ${chain.map((f) => f.replace(SRC, "src")).join(" -> ")}` : "",
    ).toBeNull();
  });
});
