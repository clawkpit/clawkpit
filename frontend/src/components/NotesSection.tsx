import { useState } from "react";
import type { ItemNote } from "@/types/items";
import { formatRelativeTime } from "@/types/items";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PlusIcon, SparklesIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotesSectionProps {
  notes: ItemNote[];
  onAddNote?: (content: string) => void;
  onEditNote?: (noteId: string, content: string) => void;
}

export function NotesSection({ notes, onAddNote, onEditNote }: NotesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const handleAddNote = () => {
    if (newNoteContent.trim()) {
      onAddNote?.(newNoteContent.trim());
      setNewNoteContent("");
      setIsAdding(false);
    }
  };

  const handleEditNote = (noteId: string) => {
    if (editContent.trim()) {
      onEditNote?.(noteId, editContent.trim());
      setEditingNoteId(null);
      setEditContent("");
    }
  };

  const startEditing = (note: ItemNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-touch">
        <h3 className="text-sm font-semibold text-foreground">Notes</h3>
        {!isAdding && (
          <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
            <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
            Add Note
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30 animate-micro-in">
          <Textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Add your thoughts..."
            className="min-h-[80px] text-sm resize-none bg-background"
            autoFocus
          />
          <div className="flex gap-touch justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setNewNoteContent(""); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddNote} disabled={!newNoteContent.trim()} haptic="success">
              Save Note
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {notes.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground/60 text-center py-8">No notes yet</p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className={cn(
              "p-3 rounded-lg border animate-micro-in",
              note.author === "AI" ? "bg-muted/30 border-border/50" : "bg-card border-border"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              {note.author === "AI" ? (
                <SparklesIcon className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">{note.author}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(note.createdAt)}</span>
              {note.updatedAt.getTime() !== note.createdAt.getTime() && (
                <span className="text-xs text-muted-foreground/70">(edited)</span>
              )}
            </div>
            {editingNoteId === note.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                  autoFocus
                />
                <div className="flex gap-touch justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setEditingNoteId(null); setEditContent(""); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => handleEditNote(note.id)} disabled={!editContent.trim()}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                {note.author === "User" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(note)}
                    className="mt-1 -ml-3 text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </Button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
