import { SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

export type SortValue = "newest" | "oldest" | "title";

interface FilterPopoverProps {
  categories: string[];
  sources: string[];
  categoryFilter: string;
  sourceFilter: string;
  sortBy: SortValue;
  onCategoryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSortChange: (value: SortValue) => void;
  onClear: () => void;
}

export function FilterPopover({
  categories,
  sources,
  categoryFilter,
  sourceFilter,
  sortBy,
  onCategoryChange,
  onSourceChange,
  onSortChange,
  onClear,
}: FilterPopoverProps) {
  const activeCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
      >
        <SlidersHorizontal className="size-4" />
        Filters
        {activeCount > 0 && (
          <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Category</label>
          <Select value={categoryFilter} onValueChange={onCategoryChange}>
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Source</label>
          <Select value={sourceFilter} onValueChange={onSourceChange}>
            <SelectTrigger aria-label="Filter by source">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Sort by</label>
          <Select
            value={sortBy}
            onValueChange={(value) => onSortChange(value as SortValue)}
          >
            <SelectTrigger aria-label="Sort resources">
              <SelectValue placeholder="Newest first" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {activeCount > 0 && (
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
