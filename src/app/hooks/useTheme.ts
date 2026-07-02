import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Theme is resolved before paint by the inline script in index.html
 * (stored preference, else system `prefers-color-scheme`). This hook reads
 * that resolved state off `<html>` and lets the user toggle it. A toggle
 * writes to localStorage; until then we keep following the system default.
 */
function getInitialTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch {
        // ignore storage failures (private mode, etc.)
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
