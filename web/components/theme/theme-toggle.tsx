"use client";

/**
 * Theme toggle button — cycles between light, dark, and system.
 */
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function cycle() {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }

  const icon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "💻";
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-muted)]"
      aria-label={`Current theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline text-[var(--text-secondary)]">{label}</span>
    </button>
  );
}
