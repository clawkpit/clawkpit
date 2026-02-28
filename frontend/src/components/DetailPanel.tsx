import { useState, useEffect } from "react";
import type { Item, ItemNote, ItemTag, ItemColumn, ItemImportance } from "@/types/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotesSection } from "./NotesSection";
import { ErrorState } from "./ErrorState";
import { XIcon, CheckIcon, ArchiveXIcon, RotateCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailPanelProps {
  item: Item | null;
  notes: ItemNote[];
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (payload: { title: string; description: string; tag: ItemTag; column: ItemColumn; importance: ItemImportance; deadline?: Date | null }) => void;
  onUpdate?: (itemId: string, updates: Partial<Item>) => void;
  onMarkDone?: (itemId: string) => void;
  onDrop?: (itemId: string) => void;
  onAddNote?: (itemId: string, content: string) => void;
  onEditNote?: (noteId: string, content: string) => void;
}

export function DetailPanel({
  item,
  notes,
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  onMarkDone,
  onDrop,
  onAddNote,
  onEditNote,
}: DetailPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [localTitle, setLocalTitle] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localTag, setLocalTag] = useState<ItemTag>("To Do");
  const [localColumn, setLocalColumn] = useState<ItemColumn>("Unclear");
  const [localImportance, setLocalImportance] = useState<ItemImportance>("M");
  const [localDeadline, setLocalDeadline] = useState<string>("");

  const isCreate = item === null;

  useEffect(() => {
    if (item) {
      setLocalTitle(item.title);
      setLocalDescription(item.description);
      setLocalTag(item.tag);
      setLocalColumn(item.column);
      setLocalImportance(item.importance);
      setLocalDeadline(item.deadline ? new Date(item.deadline).toISOString().slice(0, 16) : "");
      setError(null);
    } else if (isOpen) {
      setLocalTitle("");
      setLocalDescription("");
      setLocalTag("To Do");
      setLocalColumn("Unclear");
      setLocalImportance("M");
      setLocalDeadline("");
      setError(null);
    }
  }, [item, isOpen, isCreate]);

  const handleMarkDone = () => {
    if (item.tag === "To Think About" && notes.length === 0) {
      setError("Add a short note explaining your reasoning before completing this item.");
      return;
    }
    setError(null);
    onMarkDone?.(item.id);
  };

  const handleDrop = () => {
    if (!item) return;
    if (notes.length === 0) {
      setError("Add a note before dropping this item.");
      return;
    }
    setError(null);
    onDrop?.(item.id);
  };

  const handleUndoDone = () => {
    if (!item) return;
    setError(null);
    onUpdate?.(item.id, { status: "Active" });
  };

  const handleUndoDrop = () => {
    if (!item) return;
    setError(null);
    onUpdate?.(item.id, { status: "Active" });
  };

  const handleTitleBlur = () => {
    if (item && localTitle !== item.title && localTitle.trim()) {
      onUpdate?.(item.id, { title: localTitle.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (item && localDescription !== item.description) {
      onUpdate?.(item.id, { description: localDescription });
    }
  };

  const handleCreate = () => {
    if (!localTitle.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    onCreate?.({
      title: localTitle.trim(),
      description: localDescription,
      tag: localTag,
      column: localColumn,
      importance: localImportance,
      deadline: localDeadline ? new Date(localDeadline) : null,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={onClose} aria-hidden />
      )}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-2xl bg-background border-l border-border z-50 transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {isCreate ? "New Item" : (
                <>
                  <span className="font-mono text-muted-foreground/80">#{item.humanId}</span>
                  <span className="ml-2">Item Details</span>
                </>
              )}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <XIcon className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {error && (
              <ErrorState
                message={error}
                suggestion={
                  !isCreate && item
                    ? item.tag === "To Think About"
                      ? "Items tagged 'To Think About' require reflection notes."
                      : "Brief context helps track why items were archived."
                    : undefined
                }
              />
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="text-base font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                placeholder="Add details..."
                className="min-h-[100px] resize-none text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Activity</label>
                <Select
                  value={localTag}
                  onValueChange={(v) => {
                    setLocalTag(v as ItemTag);
                    if (item) onUpdate?.(item.id, { tag: v as ItemTag });
                  }}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="To Read">To Read</SelectItem>
                    <SelectItem value="To Think About">To Think About</SelectItem>
                    <SelectItem value="To Use">To Use</SelectItem>
                    <SelectItem value="To Do">To Do</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Urgency</label>
                <Select
                  value={localColumn}
                  onValueChange={(v) => {
                    setLocalColumn(v as ItemColumn);
                    if (item) onUpdate?.(item.id, { column: v as ItemColumn });
                  }}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DoNow">Do Now</SelectItem>
                    <SelectItem value="DoToday">Do Today</SelectItem>
                    <SelectItem value="DoThisWeek">Do This Week</SelectItem>
                    <SelectItem value="DoLater">Do Later</SelectItem>
                    <SelectItem value="Unclear">Unclear</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Importance</label>
                <Select
                  value={localImportance}
                  onValueChange={(v) => {
                    setLocalImportance(v as ItemImportance);
                    if (item) onUpdate?.(item.id, { importance: v as ItemImportance });
                  }}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="H">High</SelectItem>
                    <SelectItem value="M">Medium</SelectItem>
                    <SelectItem value="L">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Deadline</label>
                <Input
                  type="datetime-local"
                  value={localDeadline}
                  onChange={(e) => {
                    setLocalDeadline(e.target.value);
                    if (item) onUpdate?.(item.id, { deadline: e.target.value ? new Date(e.target.value) : undefined });
                  }}
                  className="text-sm"
                />
              </div>
            </div>

            {isCreate ? (
              <div className="pt-4 border-t border-border">
                <Button onClick={handleCreate} className="w-full">
                  <CheckIcon className="w-4 h-4 mr-2" />
                  Create Item
                </Button>
              </div>
            ) : (
              <>
                <div className="pt-4 border-t border-border">
                  <div className="flex gap-3">
                    {item.status === "Done" ? (
                      <Button onClick={handleUndoDone} className="flex-1" variant="default">
                        <RotateCcwIcon className="w-4 h-4 mr-2" />
                        Undo Done
                      </Button>
                    ) : item.status === "Dropped" ? (
                      <Button onClick={handleUndoDrop} className="flex-1" variant="default">
                        <RotateCcwIcon className="w-4 h-4 mr-2" />
                        Undo Drop
                      </Button>
                    ) : (
                      <>
                        <Button onClick={handleMarkDone} className="flex-1" variant="default">
                          <CheckIcon className="w-4 h-4 mr-2" />
                          Mark Done
                        </Button>
                        <Button onClick={handleDrop} variant="outline" className="flex-1">
                          <ArchiveXIcon className="w-4 h-4 mr-2" />
                          Drop
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="pt-6 border-t border-border">
                  <NotesSection
                    notes={notes}
                    onAddNote={(content) => onAddNote?.(item.id, content)}
                    onEditNote={onEditNote}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
