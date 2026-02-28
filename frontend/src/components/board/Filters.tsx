import { useState } from "react";
import type { FilterState } from "@/types/items";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { XIcon, FilterIcon, ChevronDownIcon } from "lucide-react";

interface BoardFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function BoardFilters({ filters, onFiltersChange }: BoardFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.importance !== "All" ||
    filters.hasDeadline !== "All" ||
    filters.createdBy !== "All" ||
    filters.modifiedBy !== "All";

  const resetFilters = () => {
    onFiltersChange({
      importance: "All",
      hasDeadline: "All",
      createdBy: "All",
      modifiedBy: "All",
    });
  };

  const activeFilterCount = [
    filters.importance !== "All",
    filters.hasDeadline !== "All",
    filters.createdBy !== "All",
    filters.modifiedBy !== "All",
  ].filter(Boolean).length;

  const filterRow = (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Importance</span>
        <Select value={filters.importance} onValueChange={(v) => onFiltersChange({ ...filters, importance: v as FilterState["importance"] })}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="H">High</SelectItem>
            <SelectItem value="M">Medium</SelectItem>
            <SelectItem value="L">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Deadline</span>
        <Select value={filters.hasDeadline} onValueChange={(v) => onFiltersChange({ ...filters, hasDeadline: v as "All" | "Yes" | "No" })}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Yes">Has Deadline</SelectItem>
            <SelectItem value="No">No Deadline</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Created By</span>
        <Select value={filters.createdBy} onValueChange={(v) => onFiltersChange({ ...filters, createdBy: v as FilterState["createdBy"] })}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="User">User</SelectItem>
            <SelectItem value="AI">AI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Modified By</span>
        <Select value={filters.modifiedBy} onValueChange={(v) => onFiltersChange({ ...filters, modifiedBy: v as FilterState["modifiedBy"] })}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="User">User</SelectItem>
            <SelectItem value="AI">AI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
          <XIcon className="w-3.5 h-3.5 mr-1.5" /> Reset
        </Button>
      )}
    </>
  );

  return (
    <div>
      <div className="hidden md:flex items-center gap-3 flex-wrap">{filterRow}</div>
      <div className="md:hidden">
        <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="w-full h-9 justify-between">
          <span className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4" />
            <span className="text-xs font-medium">
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </span>
          </span>
          <ChevronDownIcon className={"w-4 h-4 transition-transform " + (isExpanded ? "rotate-180" : "")} />
        </Button>
        {isExpanded && (
          <div className="mt-3 space-y-3 p-3 border border-border rounded-lg bg-card">{filterRow}</div>
        )}
      </div>
    </div>
  );
}
