"use client";

/**
 * Client-side loader for the CommandPalette.
 *
 * `next/dynamic` with `ssr: false` is only allowed in Client Components.
 * This thin wrapper is the Client Component boundary so the Server Component
 * app layout can render it without triggering the Turbopack build error:
 * "ssr: false is not allowed with next/dynamic in Server Components."
 */
import dynamic from "next/dynamic";

const CommandPalette = dynamic(
  () =>
    import("@/components/ui/command-palette").then((m) => ({
      default: m.CommandPalette,
    })),
  { ssr: false },
);

export function CommandPaletteLoader() {
  return <CommandPalette />;
}
