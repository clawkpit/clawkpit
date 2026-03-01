import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import type { Item, ItemNote } from "@/types/items";
import type { ItemContentType } from "@/types/items";
import { listItems, listNotes, addNote, updateNote, markDone, dropItem, updateItem } from "@/api/client";
import { BoardCard } from "@/components/board/Card";
import { DetailPanel } from "@/components/DetailPanel";
import { FormModal } from "@/components/FormModal";
import { MarkdownModal } from "@/components/MarkdownModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchIcon, CheckCircle2Icon, XCircleIcon, FilterIcon } from "lucide-react";
import { useMinuteTick } from "@/hooks/useMinuteTick";

type ArchiveStatusFilter = "All" | "Done" | "Dropped";

export function ArchivePage() {
  useMinuteTick(); // refresh time-left / overdue and "X ago" every minute
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ArchiveStatusFilter>("All");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [panelNotes, setPanelNotes] = useState<ItemNote[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [contentModal, setContentModal] = useState<{ type: ItemContentType; contentId: string; itemId: string } | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      if (statusFilter === "All") {
        const res = await listItems({ status: "All", page: 1, pageSize: 500 });
        setItems(res.items.filter((i) => i.status === "Done" || i.status === "Dropped"));
      } else {
        const res = await listItems({ status: statusFilter, page: 1, pageSize: 500 });
        setItems(res.items);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [statusFilter]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tag.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  }, [items, searchQuery]);

  const doneCount = items.filter((i) => i.status === "Done").length;
  const droppedCount = items.filter((i) => i.status === "Dropped").length;

  const handleItemClick = async (item: Item) => {
    setSelectedItem(item);
    setIsPanelOpen(true);
    try {
      const notes = await listNotes(item.id);
      setPanelNotes(notes);
    } catch {
      setPanelNotes([]);
    }
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedItem(null);
    setPanelNotes([]);
  };

  const handleUpdate = async (itemId: string, updates: Partial<Item>) => {
    await updateItem(itemId, updates);
    if (updates.status === "Active") {
      handleClosePanel();
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      return;
    }
    setSelectedItem((prev) => (prev && prev.id === itemId ? { ...prev, ...updates } : prev));
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i)));
  };

  const handleMarkDone = async (itemId: string) => {
    try {
      await markDone(itemId);
      handleClosePanel();
      loadItems();
    } catch {
      // validation error shown in panel
    }
  };

  const handleDrop = async (itemId: string) => {
    try {
      await dropItem(itemId);
      handleClosePanel();
      loadItems();
    } catch {
      // validation error shown in panel
    }
  };

  const handleAddNote = async (itemId: string, content: string) => {
    await addNote(itemId, content, "User");
    const notes = await listNotes(itemId);
    setPanelNotes(notes);
  };

  const handleEditNote = async (noteId: string, content: string) => {
    await updateNote(noteId, content, "User");
    if (selectedItem) {
      const notes = await listNotes(selectedItem.id);
      setPanelNotes(notes);
    }
  };

  const handleContentAction = (type: ItemContentType, item: Item) => {
    if (item.contentId) setContentModal({ type, contentId: item.contentId, itemId: item.id });
  };

  const handleContentModalClose = () => {
    setContentModal(null);
    loadItems();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background sticky top-0 z-30">
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Archived Items</h1>
            <div className="flex gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <CheckCircle2Icon className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                {doneCount} Done
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <XCircleIcon className="w-3.5 h-3.5 text-muted-foreground" />
                {droppedCount} Dropped
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-6 mb-3 md:mb-4">
            <div className="flex gap-2">
              <Link to="/board">
                <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
                  Back to Active Items
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredItems.length} of {items.length} items
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by title, description, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === "All" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("All")}
                className="h-9"
              >
                <FilterIcon className="w-3.5 h-3.5 mr-1.5" />
                All
              </Button>
              <Button
                variant={statusFilter === "Done" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("Done")}
                className="h-9"
              >
                <CheckCircle2Icon className="w-3.5 h-3.5 mr-1.5" />
                Done
              </Button>
              <Button
                variant={statusFilter === "Dropped" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("Dropped")}
                className="h-9"
              >
                <XCircleIcon className="w-3.5 h-3.5 mr-1.5" />
                Dropped
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <SearchIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No items found</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {searchQuery
                ? "No archived items match your search. Try different keywords or clear the search."
                : "You don't have any archived items yet. Completed or dropped items will appear here."}
            </p>
            {searchQuery && (
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="mt-4">
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div key={item.id} className="relative">
                <div className="absolute -top-2 -right-2 z-10">
                  {item.status === "Done" ? (
                    <Badge className="bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-500/20">
                      <CheckCircle2Icon className="w-3 h-3 mr-1" />
                      Done
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                      <XCircleIcon className="w-3 h-3 mr-1" />
                      Dropped
                    </Badge>
                  )}
                </div>
                <div onClick={() => handleItemClick(item)}>
                  <BoardCard item={item} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DetailPanel
        item={selectedItem}
        notes={panelNotes}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        onUpdate={handleUpdate}
        onMarkDone={handleMarkDone}
        onDrop={handleDrop}
        onAddNote={handleAddNote}
        onEditNote={handleEditNote}
        onContentAction={handleContentAction}
      />
      <MarkdownModal
        open={contentModal?.type === "markdown"}
        onOpenChange={(open) => !open && setContentModal(null)}
        contentId={contentModal?.type === "markdown" ? contentModal.contentId : null}
        itemId={contentModal?.type === "markdown" ? contentModal.itemId ?? null : null}
        onMarkRead={handleContentModalClose}
      />
      <FormModal
        open={contentModal?.type === "form"}
        onOpenChange={(open) => !open && setContentModal(null)}
        contentId={contentModal?.type === "form" ? contentModal.contentId : null}
        itemId={contentModal?.type === "form" ? contentModal.itemId ?? null : null}
        onSubmit={handleContentModalClose}
      />
    </div>
  );
}
