"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { Resource } from "@/app/components/types";
import { getHostname } from "@/app/components/resource-format";
import { cn } from "@/app/components/ui/utils";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onSubmitQuery: () => void;
  resources: Resource[];
  isSearching: boolean;
}

const MAX_RESULTS = 50;

export function SearchModal({
  open,
  onOpenChange,
  query,
  onQueryChange,
  onSubmitQuery,
  resources,
  isSearching,
}: SearchModalProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const visible = trimmed && !isSearching ? resources.slice(0, MAX_RESULTS) : [];

  useEffect(() => {
    setHighlightedIndex(null);
  }, [trimmed, resources.length]);

  useEffect(() => {
    if (highlightedIndex === null) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlightedIndex}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const openResource = (resource: Resource) => {
    window.open(resource.url, "_blank", "noreferrer");
    onOpenChange(false);
  };

  const moveHighlight = (direction: 1 | -1) => {
    if (visible.length === 0) return;
    setHighlightedIndex((current) => {
      if (current === null) return direction === 1 ? 0 : visible.length - 1;
      return direction === 1
        ? Math.min(current + 1, visible.length - 1)
        : Math.max(current - 1, 0);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedIndex === null) {
        if (trimmed) onSubmitQuery();
        return;
      }
      const item = visible[highlightedIndex];
      if (item) openResource(item);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
        />
        <DialogPrimitive.Content
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "fixed top-[20%] left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-200",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search resources</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search title, notes, source, or author. Press Enter to apply the search, or use arrow
            keys or hover to select a result and open it.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-3 border-b border-slate-100 px-4">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search title, notes, source, or author"
              className="h-14 w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
              aria-label="Search resources"
            />
            {isSearching && (
              <span className="shrink-0 text-xs text-slate-400">Searching…</span>
            )}
          </div>

          <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
            {!trimmed ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Start typing to search your library.
              </p>
            ) : visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                {isSearching ? "Searching…" : "No matches found."}
              </p>
            ) : (
              visible.map((resource, index) => {
                const isActive = highlightedIndex === index;
                return (
                  <button
                    key={resource.id}
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => openResource(resource)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      isActive ? "bg-slate-100" : "bg-transparent",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {resource.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {getHostname(resource.url)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {resource.category}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>{" "}
              apply/open selected{" · "}
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>{" "}
              navigate{" · "}
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>{" "}
              close
            </span>
            {trimmed && visible.length > 0 && (
              <span>
                {visible.length}
                {resources.length > MAX_RESULTS ? "+" : ""} results
              </span>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
