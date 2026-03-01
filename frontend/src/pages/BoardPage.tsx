import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import type { Item, ItemColumn, ItemTag, FilterState } from "@/types/items";
import { Board } from "@/components/board/Board";
import { BoardFilters } from "@/components/board/Filters";
import { DetailPanel } from "@/components/DetailPanel";
import { EmptyState } from "@/components/EmptyState";
import { FormModal } from "@/components/FormModal";
import { MarkdownModal } from "@/components/MarkdownModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listItems,
  createItem,
  updateItem,
  listNotes,
  addNote,
  updateNote,
  markDone,
  dropItem,
  confirmOpenclawDevice,
  listApiKeys,
} from "@/api/client";
import { useAuth } from "@/api/client";
import { PlusIcon, ArchiveIcon, SettingsIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMinuteTick } from "@/hooks/useMinuteTick";

type ViewMode = "urgency" | "tag";

const DEFAULT_FILTERS: FilterState = {
  importance: "All",
  hasDeadline: "All",
  createdBy: "All",
  modifiedBy: "All",
};

const APP_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_URL) ||
  (typeof window !== "undefined" ? window.location.origin : "");

/** Base URL for the OpenClaw install page (openclaw.md). When the install page is on a different domain (e.g. landing at clawkpit.com, app at app.clawkpit.com), set VITE_OPENCLAW_DOCS_URL to the landing URL. */
const OPENCLAW_DOCS_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_OPENCLAW_DOCS_URL) || APP_BASE_URL;

export function BoardPage() {
  useMinuteTick(); // refresh time-left / overdue hints every minute
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("urgency");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [panelNotes, setPanelNotes] = useState<import("@/types/items").ItemNote[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [isCreate, setIsCreate] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOpenclawModal, setShowOpenclawModal] = useState(false);
  const [openclawModalCode, setOpenclawModalCode] = useState("");
  const [openclawModalLoading, setOpenclawModalLoading] = useState(false);
  const [openclawModalError, setOpenclawModalError] = useState<string | null>(null);
  const [openclawModalCopiedStep, setOpenclawModalCopiedStep] = useState<number | null>(null);
  const [contentModal, setContentModal] = useState<{ type: "markdown" | "form"; contentId: string; itemId: string } | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems({
        status: "Active",
        page: 1,
        pageSize: 100,
        importance: filters.importance !== "All" ? filters.importance : undefined,
        createdBy: filters.createdBy !== "All" ? filters.createdBy : undefined,
        modifiedBy: filters.modifiedBy !== "All" ? filters.modifiedBy : undefined,
      });
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  }, [filters.importance, filters.createdBy, filters.modifiedBy]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    let cancelled = false;
    const showAfterLogin = window.sessionStorage.getItem("clawkpit_show_openclaw_after_login");
    listApiKeys()
      .then((keys) => {
        if (!cancelled && keys.length === 0 && showAfterLogin) {
          window.sessionStorage.removeItem("clawkpit_show_openclaw_after_login");
          setShowOpenclawModal(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredItems = items.filter((item) => {
    if (filters.hasDeadline === "Yes" && !item.deadline) return false;
    if (filters.hasDeadline === "No" && item.deadline) return false;
    return true;
  });

  const handleItemClick = async (item: Item) => {
    setSelectedItem(item);
    setIsCreate(false);
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
    setIsCreate(false);
    setPanelNotes([]);
  };

  const handleNewItem = () => {
    setSelectedItem(null);
    setIsCreate(true);
    setIsPanelOpen(true);
    setPanelNotes([]);
  };

  const handleCreate = async (payload: {
    title: string;
    description: string;
    tag: ItemTag;
    column: ItemColumn;
    importance: import("@/types/items").ItemImportance;
    deadline?: Date | null;
  }) => {
    await createItem({
      ...payload,
      status: "Active",
      createdBy: "User",
    });
    handleClosePanel();
    loadItems();
  };

  const handleUpdate = async (itemId: string, updates: Partial<Item>) => {
    await updateItem(itemId, updates);
    setSelectedItem((prev) => (prev && prev.id === itemId ? { ...prev, ...updates } : prev));
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i)));
  };

  const handleItemMove = async (item: Item, targetColumn: ItemColumn | ItemTag) => {
    if (viewMode === "urgency") {
      await updateItem(item.id, { column: targetColumn as ItemColumn });
    } else {
      await updateItem(item.id, { tag: targetColumn as ItemTag });
    }
    setDraggedItem(null);
    loadItems();
  };

  const handleMarkDone = async (itemId: string) => {
    try {
      await markDone(itemId);
      handleClosePanel();
      loadItems();
    } catch (e) {
      // Error shown in panel via validation
    }
  };

  const handleDrop = async (itemId: string) => {
    try {
      await dropItem(itemId);
      handleClosePanel();
      loadItems();
    } catch (e) {
      // Error shown in panel
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

  const handleOpenclawModalDismiss = () => {
    setShowOpenclawModal(false);
  };

  const handleOpenclawModalConnect = async () => {
    if (!openclawModalCode.trim()) return;
    setOpenclawModalError(null);
    setOpenclawModalLoading(true);
    try {
      await confirmOpenclawDevice(openclawModalCode);
      setShowOpenclawModal(false);
    } catch (e) {
      setOpenclawModalError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setOpenclawModalLoading(false);
    }
  };

  const handleCopyOpenclawModalCommand = async (text: string, step: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setOpenclawModalCopiedStep(step);
      setTimeout(() => setOpenclawModalCopiedStep(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleContentAction = (type: "markdown" | "form", item: Item) => {
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
            <div className="flex items-center gap-2">
              <Link to="/" className="text-xl md:text-2xl font-semibold tracking-tight text-foreground hover:text-foreground/90">
                Clawkpit
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setIsSettingsOpen(true)}
                title="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </Button>
            </div>
            <Button size="sm" className="h-8 md:h-9" onClick={handleNewItem}>
              <PlusIcon className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">New Item</span>
            </Button>
          </div>
          <div className="flex items-center gap-4 md:gap-6 mb-3 md:mb-4">
            <div className="flex gap-2">
              <Button
                variant={viewMode === "urgency" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("urgency")}
                className="h-8 text-xs font-medium"
              >
                Urgency
              </Button>
              <Button
                variant={viewMode === "tag" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("tag")}
                className="h-8 text-xs font-medium"
              >
                Activity
              </Button>
              <Link to="/board/archive">
                <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
                  <ArchiveIcon className="w-3.5 h-3.5 mr-1.5" />
                  Archive
                </Button>
              </Link>
            </div>
          </div>
          <BoardFilters filters={filters} onFiltersChange={setFilters} />
        </div>
      </div>

      <div className="px-4 md:px-6 py-4 md:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title="No items"
            description="Create an item or adjust filters to see your board."
          />
        ) : (
          <Board
            items={filteredItems}
            viewMode={viewMode}
            filters={filters}
            onItemClick={handleItemClick}
            onItemMove={handleItemMove}
            draggedItem={draggedItem}
            onDragStart={setDraggedItem}
            onDragEnd={() => setDraggedItem(null)}
            onAction={handleContentAction}
          />
        )}
      </div>

      <DetailPanel
        item={isCreate ? null : selectedItem}
        notes={panelNotes}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        onCreate={handleCreate}
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
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConnectOpenclawClick={() => {
          setIsSettingsOpen(false);
          setShowOpenclawModal(true);
        }}
      />

      <Dialog open={showOpenclawModal} onOpenChange={(open) => !open && handleOpenclawModalDismiss()}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)]" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Connect OpenClaw</DialogTitle>
            <DialogDescription>
              Connect your OpenClaw agent to this Clawkpit account so it can manage your board. Follow the steps below; each command can be copied with one click.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 min-w-0">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground mb-1">1. Install the skill (if needed)</p>
              <p className="text-xs text-muted-foreground mb-1.5">
                If your agent doesn&apos;t have the Clawkpit skill yet, ask it to open the onboarding page and follow the install steps. Copy and paste this into OpenClaw:
              </p>
              <button
                type="button"
                onClick={() => handleCopyOpenclawModalCommand(`Open ${OPENCLAW_DOCS_BASE_URL}/openclaw.md and follow the steps to install the Clawkpit skill.`, 1)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left min-w-0",
                  "hover:bg-muted/50 transition-colors"
                )}
              >
                <code className="text-xs font-mono text-foreground truncate min-w-0 flex-1">
                  {`Open ${OPENCLAW_DOCS_BASE_URL}/openclaw.md and follow the steps to install the Clawkpit skill.`}
                </code>
                {openclawModalCopiedStep === 1 ? (
                  <span className="text-xs text-green-600 dark:text-green-400 shrink-0">Copied!</span>
                ) : (
                  <CopyIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0 flex-shrink-0" />
                )}
              </button>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground mb-1">2. Connect your bot to this account</p>
              <p className="text-xs text-muted-foreground mb-1.5">
                In OpenClaw, run the command below (it includes your email so the agent can start the flow right away).
              </p>
              <button
                type="button"
                onClick={() => handleCopyOpenclawModalCommand(`/clawkpit connect ${user?.email ?? ""}`.trim(), 2)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left min-w-0",
                  "hover:bg-muted/50 transition-colors"
                )}
              >
                <code className="text-xs font-mono text-foreground truncate min-w-0 flex-1">/clawkpit connect {user?.email ?? ""}</code>
                {openclawModalCopiedStep === 2 ? (
                  <span className="text-xs text-green-600 dark:text-green-400 shrink-0">Copied!</span>
                ) : (
                  <CopyIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0 flex-shrink-0" />
                )}
              </button>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground mb-1">3. Paste the code and confirm</p>
              <p className="text-xs text-muted-foreground mb-1.5">
                Your agent will show a short code (e.g. XXXX-XXXX). Paste it below and click Connect.
              </p>
              <Input
                placeholder="e.g. XXXX-XXXX"
                value={openclawModalCode}
                onChange={(e) => setOpenclawModalCode(e.target.value)}
                className="font-mono text-sm"
                disabled={openclawModalLoading}
              />
            </div>
          </div>
          {openclawModalError && <p className="text-xs text-destructive">{openclawModalError}</p>}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={handleOpenclawModalDismiss}>
              Maybe later
            </Button>
            <Button size="sm" onClick={handleOpenclawModalConnect} disabled={openclawModalLoading || !openclawModalCode.trim()}>
              {openclawModalLoading ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
