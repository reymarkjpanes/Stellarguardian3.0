/**
 * Architecture fitness tests (Task 4.1).
 *
 * Enforces architectural boundaries statically by scanning import statements:
 *
 * 1. Domain layer (src/domains/*) must not import infrastructure (@supabase, next/, etc.)
 * 2. UI layer (app/, components/) must not import repositories directly
 * 3. Server-only modules must not be imported in "use client" components
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

/** Recursively list all files matching an extension pattern. */
function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function readImports(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const importRegex = /(?:import|from)\s+["']([^"']+)["']/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    matches.push(match[1]!);
  }
  return matches;
}

// ── 1. Domain layer isolation ────────────────────────────────────────────────
describe("Architecture: Domain layer must not import infrastructure", () => {
  const domainDir = join(ROOT, "src", "domains");
  const INFRA_PATTERNS = ["@supabase/", "@upstash/", "next/", "next-auth", "@stellar/stellar-sdk"];

  if (!existsSync(domainDir)) {
    it("skipped — src/domains/ not yet populated", () => {
      expect(true).toBe(true);
    });
  } else {
    const domainFiles = [...walk(join(domainDir), ".ts"), ...walk(join(domainDir), ".tsx")].filter(
      (f) => f.includes("/domain/"),
    );

    if (domainFiles.length === 0) {
      it("skipped — no domain/*.ts files found yet", () => expect(true).toBe(true));
    } else {
      domainFiles.forEach((file) => {
        it(`${file.replace(ROOT, "")} has no infrastructure imports`, () => {
          const imports = readImports(file);
          const violations = imports.filter((imp) =>
            INFRA_PATTERNS.some((pat) => imp.startsWith(pat)),
          );
          expect(violations).toHaveLength(0);
        });
      });
    }
  }
});

// ── 2. UI must not import repositories directly ──────────────────────────────
describe("Architecture: UI must not import repositories directly", () => {
  const appDir = join(ROOT, "app");
  const componentsDir = join(ROOT, "components");

  const uiFiles = [...walk(appDir, ".tsx"), ...walk(componentsDir, ".tsx")].filter(
    (f) => !f.includes(".test.") && !f.includes(".spec.") && !f.includes("__tests__"),
  );

  if (uiFiles.length === 0) {
    it("skipped — no UI files found", () => expect(true).toBe(true));
  } else {
    uiFiles.forEach((file) => {
      it(`${file.replace(ROOT, "")} does not import from lib/repositories`, () => {
        const imports = readImports(file);
        const violations = imports.filter(
          (imp) => imp.includes("lib/repositories") || imp.includes("@/lib/repositories"),
        );
        expect(violations).toHaveLength(0);
      });
    });
  }
});

// ── 3. "use client" files must not import server-only modules ────────────────
describe("Architecture: Client components must not import server-only modules", () => {
  const appDir = join(ROOT, "app");
  const componentsDir = join(ROOT, "components");

  const allTsx = [...walk(appDir, ".tsx"), ...walk(componentsDir, ".tsx")].filter(
    (f) => !f.includes(".test.") && !f.includes("__tests__"),
  );

  const SERVER_ONLY_PATTERNS = [
    "@/lib/supabase/service",
    "@/lib/services/kms",
    "@/lib/repositories",
    "@/lib/services/audit",
    "server-only",
  ];

  allTsx.forEach((file) => {
    const content = readFileSync(file, "utf-8");
    const isClientComponent = content.includes('"use client"') || content.includes("'use client'");
    if (!isClientComponent) return;

    it(`Client component ${file.replace(ROOT, "")} does not import server-only modules`, () => {
      const imports = readImports(file);
      const violations = imports.filter((imp) =>
        SERVER_ONLY_PATTERNS.some((pat) => imp.includes(pat)),
      );
      expect(violations).toHaveLength(0);
    });
  });

  // If no client components found, add a placeholder
  const clientFiles = allTsx.filter((f) => {
    const content = readFileSync(f, "utf-8");
    return content.includes('"use client"') || content.includes("'use client'");
  });

  if (clientFiles.length === 0) {
    it("skipped — no client components found", () => expect(true).toBe(true));
  }
});
