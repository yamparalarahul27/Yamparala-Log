import { useEffect, useState } from "react";

// Mirrors the breakpoints the grid used as `md:columns-2 lg:columns-3
// xl:columns-4 2xl:columns-5` so column density doesn't change.
const COLUMN_BREAKPOINTS = [
  { minWidth: 1536, columns: 5 },
  { minWidth: 1280, columns: 4 },
  { minWidth: 1024, columns: 3 },
  { minWidth: 768, columns: 2 },
] as const;

function getColumnCount(): number {
  const match = COLUMN_BREAKPOINTS.find((bp) => window.matchMedia(`(min-width: ${bp.minWidth}px)`).matches);
  return match?.columns ?? 1;
}

export function useResponsiveColumns(): number {
  const [columns, setColumns] = useState(getColumnCount);

  useEffect(() => {
    const queries = COLUMN_BREAKPOINTS.map((bp) => window.matchMedia(`(min-width: ${bp.minWidth}px)`));
    const update = () => setColumns(getColumnCount());
    queries.forEach((mq) => mq.addEventListener("change", update));
    return () => queries.forEach((mq) => mq.removeEventListener("change", update));
  }, []);

  return columns;
}
