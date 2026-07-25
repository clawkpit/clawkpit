import { useState } from "react";
import type { FilterState, Project } from "@/types/items";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { XIcon, FilterIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BoardFiltersProps {
  filters: FilterState;
  projects: Project[];
  onFiltersChange: (filters: FilterState) => void;
}

export function BoardFilters({ filters, projects, onFiltersChange }: BoardFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.importance !== "All" ||
    filters.hasDeadline !== "All" ||
    filters.createdBy !== "All" ||
    filters.modifiedBy !== "All" ||
    filters.assignedTo !== "All" ||
    filters.project !== "All";

  const resetFilters = () => {
    onFiltersChange({
      importance: "All",
      hasDeadline: "All",
      createdBy: "All",
      modifiedBy: "All",
      assignedTo: "All",
      project: "All",
    });
  };

  const activeFilterCount = [
    filters.importance !== "All",
    filters.hasDeadline !== "All",
    filters.createdBy !== "All",
    filters.modifiedBy !== "All",
    filters.assignedTo !== "All",
    filters.project !== "All",
  ].filter(Boolean).length;

  const filterRow = (
    <>
      <div className="flex items-center gap-touch">
        <span className="text-xs font-medium text-muted-foreground">Importance</span>
        <Select value={filters.importance} onValueChange={(v) => onFiltersChange({ ...filters, importance: v as FilterState["importance"] })}>
          <SelectTrigger className="text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="H">High</SelectItem>
            <SelectItem value="M">Medium</SelectItem>
            <SelectItem value="L">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-touch">
        <span className="text-xs font-medium text-muted-foreground">Deadline</span>
        <Select value={filters.hasDeadline} onValueChange={(v) => onFiltersChange({ ...filters, hasDeadline: v as "All" | "Yes" | "No" })}>
          <SelectTrigger className="text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Yes">Has Deadline</SelectItem>
            <SelectItem value="No">No Deadline</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-touch">
        <span className="text-xs font-medium text-muted-foreground">Created By</span>
        <Select value={filters.createdBy} onValueChange={(v) => onFiltersChange({ ...filters, createdBy: v as FilterState["createdBy"] })}>
          <SelectTrigger className="text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="User">User</SelectItem>
            <SelectItem value="AI">AI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-touch">
        <span className="text-xs font-medium text-muted-foreground">Project</span>
        <Select
          value={filters.project}
          onValueChange={(v) => onFiltersChange({ ...filters, project: v })}
        >
          <SelectTrigger className="text-xs w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All projects</SelectItem>
            <SelectItem value="None">No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-touch">
        <span className="text-xs font-medium text-muted-foreground">Modified By</span>
        <Select value={filters.modifiedBy} onValueChange={(v) => onFiltersChange({ ...filters, modifiedBy: v as FilterState["modifiedBy"] })}>
          <SelectTrigger className="text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="User">User</SelectItem>
            <SelectItem value="AI">AI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-touch">
        <span className="text-xs font-medium text-muted-foreground">Assigned to</span>
        <Select value={filters.assignedTo} onValueChange={(v) => onFiltersChange({ ...filters, assignedTo: v as FilterState["assignedTo"] })}>
          <SelectTrigger className="text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="User">User</SelectItem>
            <SelectItem value="AI">AI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <XIcon className="w-3.5 h-3.5 mr-1.5" /> Reset
        </Button>
      )}
    </>
  );

  return (
    <div>
      <div className="hidden md:flex items-center gap-touch flex-wrap">{filterRow}</div>
      <div className="md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between"
          aria-expanded={isExpanded}
        >
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
          <ChevronDownIcon
            className={cn(
              "w-4 h-4 transition-transform duration-micro",
              isExpanded && "rotate-180"
            )}
          />
        </Button>
        {isExpanded && (
          <div className="mt-3 space-y-3 p-3 border border-border rounded-lg bg-card animate-micro-in">
            {filterRow}
          </div>
        )}
      </div>
    </div>
  );
}
