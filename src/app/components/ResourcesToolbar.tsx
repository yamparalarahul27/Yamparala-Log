import { AdminGate } from "@/app/components/AdminGate";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { FilterPopover, type SortValue } from "@/app/components/FilterPopover";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  GalleryHorizontalEnd,
  LayoutGrid,
  List,
  Plus,
  Search,
  Star,
} from "lucide-react";

const SHOW_GALLERY_VIEW_TRIGGER = false;

export type TabValue = "resources" | "this-week" | "tasks" | "inbox" | "favourites";
export type ViewMode = "grid" | "list" | "gallery";

interface ResourcesToolbarProps {
  activeTab: TabValue;
  onTabChange: (value: TabValue) => void;
  inboxCount: number;
  activeSearch: string;
  onOpenSearch: () => void;
  categories: string[];
  sources: string[];
  categoryFilter: string;
  sourceFilter: string;
  sortBy: SortValue;
  onCategoryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSortChange: (value: SortValue) => void;
  onClearFilters: () => void;
  isAdmin: boolean;
  onUnlockAdmin: () => void;
  onLockAdmin: () => void;
  onOpenCreate: () => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
}

export function ResourcesToolbar({
  activeTab,
  onTabChange,
  inboxCount,
  activeSearch,
  onOpenSearch,
  categories,
  sources,
  categoryFilter,
  sourceFilter,
  sortBy,
  onCategoryChange,
  onSourceChange,
  onSortChange,
  onClearFilters,
  isAdmin,
  onUnlockAdmin,
  onLockAdmin,
  onOpenCreate,
  viewMode,
  onViewModeChange,
}: ResourcesToolbarProps) {
  // Favourites joins tasks/inbox in skipping filters and the view switcher: it
  // renders its own curated grid, small enough that narrowing it adds nothing.
  const showGridControls =
    activeTab !== "tasks" && activeTab !== "inbox" && activeTab !== "favourites";

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="hidden gap-2 sm:flex">
        <Button
          variant={activeTab === "resources" ? "default" : "outline"}
          onClick={() => onTabChange("resources")}
        >
          Resources
        </Button>
        <Button
          variant={activeTab === "this-week" ? "default" : "outline"}
          onClick={() => onTabChange("this-week")}
        >
          This Week
        </Button>
        {/* Tasks / Inbox / Favourites are admin workflow, hidden from visitors. */}
        {isAdmin && (
          <>
            <Button
              variant={activeTab === "tasks" ? "default" : "outline"}
              onClick={() => onTabChange("tasks")}
            >
              Tasks
            </Button>
            <Button
              variant={activeTab === "inbox" ? "default" : "outline"}
              className="gap-2"
              onClick={() => onTabChange("inbox")}
            >
              Inbox
              {inboxCount > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {inboxCount}
                </span>
              )}
            </Button>
            <Button
              variant={activeTab === "favourites" ? "default" : "outline"}
              className="gap-2"
              onClick={() => onTabChange("favourites")}
            >
              <Star
                className={cn("size-4", activeTab !== "favourites" && "fill-amber-400 text-amber-500")}
              />
              Favourites
            </Button>
          </>
        )}
      </div>
      <div className="sm:hidden">
        <Select value={activeTab} onValueChange={(value) => onTabChange(value as TabValue)}>
          <SelectTrigger aria-label="Switch view" className="min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resources">Resources</SelectItem>
            <SelectItem value="this-week">This Week</SelectItem>
            {isAdmin && (
              <>
                <SelectItem value="tasks">Tasks</SelectItem>
                <SelectItem value="inbox">Inbox</SelectItem>
                <SelectItem value="favourites">Favourites</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="outline"
          className="min-w-0 gap-2"
          onClick={onOpenSearch}
          aria-label="Search resources"
        >
          <Search className="size-4" />
          <span className="hidden max-w-[12rem] truncate sm:inline">
            {activeSearch || "Search"}
          </span>
          <kbd className="hidden rounded border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] text-stone-500 dark:text-stone-400 sm:inline">
            /
          </kbd>
        </Button>
        {showGridControls && (
          <FilterPopover
            categories={categories}
            sources={sources}
            categoryFilter={categoryFilter}
            sourceFilter={sourceFilter}
            sortBy={sortBy}
            onCategoryChange={onCategoryChange}
            onSourceChange={onSourceChange}
            onSortChange={onSortChange}
            onClear={onClearFilters}
          />
        )}
        {isAdmin && (
          <Button
            className="gap-2"
            onClick={onOpenCreate}
            aria-label="Save resource"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Save resource</span>
          </Button>
        )}
        <AdminGate isAdmin={isAdmin} onUnlock={onUnlockAdmin} onLock={onLockAdmin} />
        {showGridControls && (
          <div className="flex gap-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              aria-label="Grid view"
              onClick={() => onViewModeChange("grid")}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              aria-label="List view"
              onClick={() => onViewModeChange("list")}
            >
              <List className="size-4" />
            </Button>
            {SHOW_GALLERY_VIEW_TRIGGER && (
              <Button
                variant={viewMode === "gallery" ? "default" : "ghost"}
                size="icon"
                aria-label="Gallery view"
                onClick={() => onViewModeChange("gallery")}
              >
                <GalleryHorizontalEnd className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
