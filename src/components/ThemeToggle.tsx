"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // avoid SSR mismatch

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm
                 border-zinc-200 text-zinc-700 hover:bg-zinc-50
                 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <span
        className="inline-block h-4 w-4 rounded-full
                   bg-gradient-to-br from-yellow-300 to-amber-500
                   dark:from-sky-500 dark:to-indigo-600"
      />
      {isDark ? "Dark" : "Light"}
    </button>
  );
}
