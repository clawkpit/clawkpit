import { useState } from "react";
import type { Item, ItemColumn, ItemTag, ItemContentType } from "@/types/items";
import { BoardCard } from "./Card";
import { cn } from "@/lib/utils";

interface BoardColumnProps {
  title: string;
  columnKey: ItemColumn | ItemTag;
  items: Item[];
  viewMode?: "urgency" | "tag";
  /** When true, column is collapsed to a narrow strip with vertical header (desktop only) */
  collapsed?: boolean;
  /** Called when column header is clicked (desktop only) to toggle collapse */
  onHeaderClick?: () => void;
  onItemClick?: (item: Item) => void;
  onDrop?: (item: Item, targetColumn: ItemColumn | ItemTag) => void;
  draggedItem?: Item | null;
  onDragStart?: (item: Item) => void;
  onDragEnd?: () => void;
  /** When user clicks Read/Open Form on an item with contentId. */
  onAction?: (type: ItemContentType, item: Item) => void;
  className?: string;
}

export function BoardColumn({
  title,
  columnKey,
  items,
  viewMode = "urgency",
  collapsed = false,
  onHeaderClick,
  onItemClick,
  onDrop,
  draggedItem,
  onDragStart,
  onDragEnd,
  onAction,
  className,
}: BoardColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (draggedItem) onDrop?.(draggedItem, columnKey);
  };

  const headerLabel = `${title} (${items.length})`;

  return (
    <div
      className={cn(
        "flex flex-col shrink-0",
        collapsed ? "min-w-[48px] w-12 md:min-w-[48px] md:w-12" : "min-w-[320px] md:max-w-[320px]",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Desktop: clickable header — horizontal when expanded, vertical when collapsed */}
      <div className="hidden md:block">
        {collapsed ? (
          <button
            type="button"
            onClick={onHeaderClick}
            className={cn(
              "w-full flex-1 min-h-[200px] flex items-center justify-center py-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
              isDragOver && "bg-accent/50 ring-2 ring-primary/20"
            )}
            title={headerLabel}
          >
            <span
              className="text-xs font-semibold text-foreground whitespace-nowrap origin-center"
              style={{ transform: "rotate(-90deg)" }}
            >
              {headerLabel}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onHeaderClick}
            className="w-full flex items-baseline justify-between mb-3 px-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
          >
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <span className="text-xs text-muted-foreground">{items.length}</span>
          </button>
        )}
      </div>

      {/* Cards area — hidden when collapsed (desktop) */}
      {!collapsed && (
        <div
          className={cn(
            "flex-1 space-y-2.5 min-h-[200px] rounded-lg transition-colors",
            isDragOver && "bg-accent/50 ring-2 ring-primary/20"
          )}
        >
          {items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              viewMode={viewMode}
              onClick={() => onItemClick?.(item)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={draggedItem?.id === item.id}
              onAction={onAction}
            />
          ))}
          {items.length === 0 && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground/50">
              No items
            </div>
          )}
        </div>
      )}
    </div>
  );
}
