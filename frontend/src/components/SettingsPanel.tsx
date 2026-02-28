import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/api/client";
import { updateMe, listApiKeys, createApiKey, deleteApiKey, logout, type ApiKeyMeta } from "@/api/client";
import { XIcon, CopyIcon, PlusIcon, Trash2Icon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectOpenclawClick?: () => void;
}

export function SettingsPanel({ isOpen, onClose, onConnectOpenclawClick }: SettingsPanelProps) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState<string>("Email updated.");
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKeyModal, setNewKeyModal] = useState<{ id: string; key: string } | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [createKeyLoading, setCreateKeyLoading] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");

  useEffect(() => {
    if (user) setEmail(user.email ?? "");
  }, [user]);

  const loadKeys = useCallback(async () => {
    if (!isOpen) return;
    setKeysLoading(true);
    try {
      const list = await listApiKeys();
      setKeys(list);
    } catch {
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleSaveEmail = async () => {
    if (!user || !email.trim()) return;
    setEmailError(null);
    setEmailSuccess(false);
    try {
      const result = await updateMe({ email: email.trim() });
      if (result.pendingEmailChange) {
        setEmailSuccess(true);
        setEmailError(null);
        setEmailSuccessMessage(result.message ?? "Verification email sent. Check the new address to confirm.");
      } else {
        setUser(result.user);
        setEmailSuccess(true);
        setEmailSuccessMessage("Email updated.");
      }
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Failed to update email");
    }
  };

  const handleCreateKey = async () => {
    setCreateKeyLoading(true);
    setEmailError(null);
    try {
      const { id, key } = await createApiKey({ name: newKeyLabel.trim() || undefined });
      setNewKeyModal({ id, key });
      setCopyDone(false);
      setNewKeyLabel("");
      loadKeys();
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Failed to create API key");
    } finally {
      setCreateKeyLoading(false);
    }
  };

  const handleCopyKey = async () => {
    if (!newKeyModal?.key) return;
    try {
      await navigator.clipboard.writeText(newKeyModal.key);
      setCopyDone(true);
    } catch {
      setCopyDone(false);
    }
  };

  const handleCloseNewKeyModal = () => {
    setNewKeyModal(null);
    setCopyDone(false);
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await deleteApiKey(id);
      loadKeys();
    } catch {
      // ignore or show toast
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      setUser(null);
      onClose();
      navigate("/login", { replace: true });
    } finally {
      setLogoutLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={onClose} aria-hidden />
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-border z-50 transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground">Settings</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <XIcon className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
            <section className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</h3>
              <div className="space-y-2">
                <Label htmlFor="settings-email" className="text-xs font-medium text-muted-foreground">
                  Email address
                </Label>
                <Input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm"
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                {emailSuccess && <p className="text-xs text-green-600 dark:text-green-400">{emailSuccessMessage}</p>}
                <Button size="sm" onClick={handleSaveEmail} disabled={email.trim() === user?.email}>
                  Save
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Keys</h3>
              <p className="text-xs text-muted-foreground">
                API keys let OpenClaw and other tools access your Clawkpit items. These keys grant access to your data only.
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-key-label" className="text-xs text-muted-foreground">
                    Label (optional)
                  </Label>
                  <Input
                    id="new-key-label"
                    placeholder="e.g. OpenClaw"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <Button size="sm" onClick={handleCreateKey} disabled={createKeyLoading}>
                  <PlusIcon className="w-3.5 h-3.5 mr-2" />
                  Create API key
                </Button>
              </div>
              {keysLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (keys ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No API keys yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(keys ?? []).map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-muted-foreground">
                        {k.name || "Unnamed key"} · {new Date(k.createdAt).toLocaleDateString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteKey(k.id)}
                        title="Revoke key"
                      >
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connect OpenClaw</h3>
              <p className="text-xs text-muted-foreground">
                Connect your OpenClaw agent to this Clawkpit account so it can manage your board.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  onClose();
                  onConnectOpenclawClick?.();
                }}
                disabled={!onConnectOpenclawClick}
              >
                (Re)Connect to OpenClaw
              </Button>
            </section>

            <section className="space-y-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-muted-foreground hover:text-destructive hover:border-destructive/50"
                onClick={handleLogout}
                disabled={logoutLoading}
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                {logoutLoading ? "Signing out…" : "Sign out"}
              </Button>
            </section>
          </div>
        </div>
      </div>

      <Dialog open={!!newKeyModal} onOpenChange={(open) => !open && handleCloseNewKeyModal()}>
        <DialogContent className="sm:max-w-md" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy this key now. After you close this dialog you won&apos;t be able to see it again. Use it as{" "}
              <code className="text-xs bg-muted px-1 rounded">Authorization: Bearer &lt;key&gt;</code> or in the{" "}
              <code className="text-xs bg-muted px-1 rounded">X-Api-Key</code> header.
            </DialogDescription>
          </DialogHeader>
          {newKeyModal && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={newKeyModal.key ?? ""}
                className="font-mono text-xs truncate"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyKey}
                disabled={!newKeyModal.key}
              >
                <CopyIcon className="w-3.5 h-3.5 mr-1.5" />
                {copyDone ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" onClick={handleCloseNewKeyModal}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
