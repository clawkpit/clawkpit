import { useState, useRef, useEffect } from "react";
import type { Item, ItemColumn, ItemTag, FilterState } from "@/types/items";
import { getItemsByColumn, getItemsByTag, COLUMNS_URGENCY, COLUMNS_TAG } from "@/types/items";
import { BoardColumn } from "./Column";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type ViewMode = "urgency" | "tag";

interface BoardProps {
  items: Item[];
  viewMode: ViewMode;
  filters: FilterState;
  onItemClick?: (item: Item) => void;
  onItemMove?: (item: Item, targetColumn: ItemColumn | ItemTag) => void;
  draggedItem?: Item | null;
  onDragStart?: (item: Item) => void;
  onDragEnd?: () => void;
}

export function Board({
  items,
  viewMode,
  filters,
  onItemClick,
  onItemMove,
  draggedItem,
  onDragStart,
  onDragEnd,
}: BoardProps) {
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartTarget = useRef<EventTarget | null>(null);
  const minSwipeDistance = 50;

  const toggleColumnCollapsed = (key: ItemColumn | ItemTag) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredItems = items.filter((item) => {
    if (filters.importance !== "All" && item.importance !== filters.importance) return false;
    if (filters.hasDeadline === "Yes" && !item.deadline) return false;
    if (filters.hasDeadline === "No" && item.deadline) return false;
    if (filters.createdBy !== "All" && item.createdBy !== filters.createdBy) return false;
    if (filters.modifiedBy !== "All" && item.modifiedBy !== filters.modifiedBy) return false;
    return true;
  });

  const columns = viewMode === "urgency" ? COLUMNS_URGENCY : COLUMNS_TAG;

  const getColumnItems = (key: ItemColumn | ItemTag) => {
    if (viewMode === "urgency") return getItemsByColumn(key as ItemColumn, filteredItems);
    return getItemsByTag(key as ItemTag, filteredItems);
  };

  const canGoPrev = currentColumnIndex > 0;
  const canGoNext = currentColumnIndex < columns.length - 1;

  const handlePrev = () => {
    if (canGoPrev) setCurrentColumnIndex((i) => i - 1);
  };

  const handleNext = () => {
    if (canGoNext) setCurrentColumnIndex((i) => i + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartTarget.current = e.target;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const startTarget = touchStartTarget.current;
    const isTouchOnCard =
      startTarget instanceof Element && startTarget.closest("[data-board-card]");
    if (isTouchOnCard) {
      touchStartX.current = 0;
      touchEndX.current = 0;
      touchStartTarget.current = null;
      return;
    }
    const swipeDistance = touchStartX.current - touchEndX.current;
    if (swipeDistance > minSwipeDistance && canGoNext) handleNext();
    else if (swipeDistance < -minSwipeDistance && canGoPrev) handlePrev();
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartTarget.current = null;
  };

  useEffect(() => {
    setCurrentColumnIndex(0);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "urgency") {
      setCollapsedColumns(new Set());
      return;
    }
    const unclearItems = getItemsByColumn("Unclear", filteredItems);
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (unclearItems.length === 0) next.add("Unclear");
      else next.delete("Unclear");
      return next;
    });
  }, [viewMode, items, filters]);

  return (
    <>
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const columnItems = getColumnItems(col.key);
          const isCollapsed = collapsedColumns.has(col.key);
          return (
            <BoardColumn
              key={col.key}
              columnKey={col.key}
              title={col.title}
              items={columnItems}
              viewMode={viewMode}
              collapsed={isCollapsed}
              onHeaderClick={() => toggleColumnCollapsed(col.key)}
              onItemClick={onItemClick}
              onDrop={onItemMove}
              draggedItem={draggedItem}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          );
        })}
      </div>

      <div
        className="md:hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between mb-4 gap-3">
          <Button variant="outline" size="sm" onClick={handlePrev} disabled={!canGoPrev} className="h-9 px-3">
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center">
            <div className="text-sm font-semibold">{columns[currentColumnIndex].title}</div>
            <div className="text-xs text-muted-foreground">
              {currentColumnIndex + 1} of {columns.length}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleNext} disabled={!canGoNext} className="h-9 px-3">
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        </div>
        <BoardColumn
          columnKey={columns[currentColumnIndex].key}
          title={columns[currentColumnIndex].title}
          items={getColumnItems(columns[currentColumnIndex].key)}
          viewMode={viewMode}
          onItemClick={onItemClick}
          className="w-full"
        />
      </div>
    </>
  );
}
