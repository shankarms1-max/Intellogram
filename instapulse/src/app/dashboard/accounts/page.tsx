"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Plus,
  Upload,
  RefreshCw,
  Pencil,
  Trash2,
  RotateCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AccountTypeBadge } from "@/components/dashboard/AccountTypeBadge";
import { SyncStatusBadge } from "@/components/dashboard/SyncStatusBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CsvUploader } from "@/components/dashboard/CsvUploader";
import { formatNumber } from "@/lib/utils";
import { normalizeInstagramUsername } from "@/lib/instagramUtils";

type AccountType = "own" | "competitor" | "influencer" | "brand" | "other";
type AccountStatus = "active" | "pending" | "failed" | "unavailable" | "disabled";

interface TrackedAccount {
  id: string;
  username: string;
  displayName: string | null;
  accountType: AccountType;
  status: AccountStatus;
  isActive: boolean;
  followersCount: number | null;
  lastSyncedAt: string | null;
  notes: string | null;
  fetchLimit: number;
  createdAt: string;
}

type AccountTypeFilter = "all" | "own" | "competitor" | "influencer" | "brand" | "other";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "own", label: "Own" },
  { value: "competitor", label: "Competitor" },
  { value: "influencer", label: "Influencer" },
  { value: "brand", label: "Brand" },
  { value: "other", label: "Other" },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AccountTypeFilter>("all");

  // Add account dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newAccountType, setNewAccountType] = useState("competitor");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newFetchLimit, setNewFetchLimit] = useState("50");

  // Edit account dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<TrackedAccount | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editAccountType, setEditAccountType] = useState("other");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editFetchLimit, setEditFetchLimit] = useState("50");

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sync
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // CSV import
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        filter === "all" ? "/api/accounts" : `/api/accounts?accountType=${filter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load accounts");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load accounts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // ─── Add account ────────────────────────────────────────────────────────────

  function openAdd() {
    setNewUsername("");
    setNewAccountType("competitor");
    setNewDisplayName("");
    setNewNotes("");
    setNewFetchLimit("50");
    setAddError(null);
    setAddOpen(true);
  }

  function handleUsernameChange(raw: string) {
    // Auto-extract from Instagram URL on paste
    const normalized = normalizeInstagramUsername(raw);
    setNewUsername(normalized !== null ? normalized : raw.replace(/^@+/, ""));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    const normalizedUsername = normalizeInstagramUsername(newUsername);
    if (!normalizedUsername) {
      setAddError("Invalid username. Use letters, numbers, dots, or underscores (max 30 chars).");
      return;
    }

    setAddLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          accountType: newAccountType,
          displayName: newDisplayName || undefined,
          notes: newNotes || undefined,
          fetchLimit: Number(newFetchLimit) || 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add account");
      setAddOpen(false);
      fetchAccounts();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Could not add account");
    } finally {
      setAddLoading(false);
    }
  }

  // ─── Edit account ───────────────────────────────────────────────────────────

  function openEdit(account: TrackedAccount) {
    setEditAccount(account);
    setEditAccountType(account.accountType);
    setEditDisplayName(account.displayName || "");
    setEditNotes(account.notes || "");
    setEditFetchLimit(String(account.fetchLimit));
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editAccount) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/accounts/${editAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: editAccountType,
          displayName: editDisplayName || null,
          notes: editNotes || null,
          fetchLimit: Number(editFetchLimit) || 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update account");
      setEditOpen(false);
      fetchAccounts();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Could not update account");
    } finally {
      setEditLoading(false);
    }
  }

  // ─── Toggle active ──────────────────────────────────────────────────────────

  async function handleToggleActive(account: TrackedAccount) {
    try {
      await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, isActive: !a.isActive } : a))
      );
    } catch {
      // silently ignore
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/accounts/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteId(null);
      fetchAccounts();
    } catch {
      // silently ignore — could add error state
    } finally {
      setDeleteLoading(false);
    }
  }

  // ─── Sync ────────────────────────────────────────────────────────────────────

  async function handleSync(accountId: string) {
    setSyncingId(accountId);
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "Sync failed");
      }
      await fetchAccounts();
    } catch {
      setError("Sync request failed");
    } finally {
      setSyncingId(null);
    }
  }

  // ─── CSV import ──────────────────────────────────────────────────────────────

  async function handleCsvUpload(content: string) {
    setCsvImporting(true);
    setCsvResult(null);
    setCsvError(null);
    try {
      const res = await fetch("/api/accounts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setCsvResult({ imported: data.imported ?? 0, skipped: data.skipped ?? 0 });
      fetchAccounts();
    } catch (e: unknown) {
      setCsvError(e instanceof Error ? e.message : "Could not import CSV");
    } finally {
      setCsvImporting(false);
    }
  }

  const filteredAccounts = accounts;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage tracked Instagram accounts across all types.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "own", "competitor", "influencer", "brand", "other"] as AccountTypeFilter[]).map(
          (type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === type
                  ? "bg-violet-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          )
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchAccounts}
          disabled={loading}
          className="ml-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading accounts…</span>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title={filter === "all" ? "No accounts yet" : `No ${filter} accounts`}
          description={
            filter === "all"
              ? "Add your first Instagram account to start tracking analytics."
              : `You have no accounts of type "${filter}" yet.`
          }
          action={
            <div className="flex gap-2">
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
              <Button variant="outline" onClick={() => setCsvOpen(true)}>
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {/* Table header (desktop) */}
          <div className="hidden md:grid grid-cols-[1fr_120px_120px_100px_120px_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Account</span>
            <span>Type</span>
            <span>Status</span>
            <span>Followers</span>
            <span>Last Synced</span>
            <span className="text-right">Actions</span>
          </div>

          {filteredAccounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              syncing={syncingId === account.id}
              onEdit={() => openEdit(account)}
              onDelete={() => setDeleteId(account.id)}
              onSync={() => handleSync(account.id)}
              onToggleActive={() => handleToggleActive(account)}
            />
          ))}
        </div>
      )}

      {/* ─── Add Account Dialog ─── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>
              Add an Instagram account to track. Enter the username and select its type.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            {addError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {addError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="add-username">Instagram Username</Label>
              <Input
                id="add-username"
                placeholder="username or instagram.com/username"
                value={newUsername}
                onChange={(e) => handleUsernameChange(e.target.value)}
                required
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Enter username without @. Instagram profile URLs are extracted automatically.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-type">Account Type</Label>
              <Select value={newAccountType} onValueChange={setNewAccountType}>
                <SelectTrigger id="add-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-display">Display Name (optional)</Label>
              <Input
                id="add-display"
                placeholder="Brand or person name"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-limit">Fetch Limit</Label>
              <Input
                id="add-limit"
                type="number"
                min={1}
                max={500}
                value={newFetchLimit}
                onChange={(e) => setNewFetchLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Max media items to fetch per sync (1–500).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-notes">Notes (optional)</Label>
              <Input
                id="add-notes"
                placeholder="Any notes about this account…"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={addLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addLoading}>
                {addLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Account Dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update the details for @{editAccount?.username}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {editError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {editError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={`@${editAccount?.username}`} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-type">Account Type</Label>
              <Select value={editAccountType} onValueChange={setEditAccountType}>
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-display">Display Name</Label>
              <Input
                id="edit-display"
                placeholder="Brand or person name"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-limit">Fetch Limit</Label>
              <Input
                id="edit-limit"
                type="number"
                min={1}
                max={500}
                value={editFetchLimit}
                onChange={(e) => setEditFetchLimit(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input
                id="edit-notes"
                placeholder="Any notes…"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently remove the tracked account and all its data. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CSV Import Dialog ─── */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Accounts from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV with columns: username, account_type, fetch_limit, notes. The
              account_type must be one of: own, competitor, influencer, brand, other.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {csvError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {csvError}
              </div>
            )}
            {csvResult && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                Imported {csvResult.imported} account{csvResult.imported !== 1 ? "s" : ""}.
                {csvResult.skipped > 0 && ` Skipped ${csvResult.skipped} (already tracked).`}
              </div>
            )}
            {csvImporting ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Importing…</span>
              </div>
            ) : (
              <CsvUploader onUpload={(content) => handleCsvUpload(content)} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCsvOpen(false); setCsvResult(null); setCsvError(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountRow({
  account,
  syncing,
  onEdit,
  onDelete,
  onSync,
  onToggleActive,
}: {
  account: TrackedAccount;
  syncing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => void;
  onToggleActive: () => void;
}) {
  const lastSynced = account.lastSyncedAt
    ? new Date(account.lastSyncedAt).toLocaleDateString()
    : "Never";

  return (
    <Card className={!account.isActive ? "opacity-60" : ""}>
      <CardContent className="py-3 px-4">
        {/* Mobile layout */}
        <div className="md:hidden space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">@{account.username}</span>
                {account.displayName && (
                  <span className="text-xs text-muted-foreground">· {account.displayName}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <AccountTypeBadge type={account.accountType} />
                <SyncStatusBadge status={account.isActive ? account.status : "disabled"} />
              </div>
            </div>
            <Switch
              checked={account.isActive}
              onCheckedChange={onToggleActive}
              aria-label="Toggle tracking"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {account.followersCount != null ? `${formatNumber(account.followersCount)} followers` : "—"}
            </span>
            <span>Synced: {lastSynced}</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden md:grid grid-cols-[1fr_120px_120px_100px_120px_auto] gap-4 items-center">
          {/* Account name */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                {account.username[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">@{account.username}</p>
                {account.displayName && (
                  <p className="text-xs text-muted-foreground truncate">{account.displayName}</p>
                )}
              </div>
            </div>
          </div>

          <AccountTypeBadge type={account.accountType} />
          <SyncStatusBadge status={account.isActive ? account.status : "disabled"} />

          <span className="text-sm text-muted-foreground">
            {account.followersCount != null ? formatNumber(account.followersCount) : "—"}
          </span>

          <span className="text-xs text-muted-foreground">{lastSynced}</span>

          {/* Actions */}
          <div className="flex items-center gap-1.5 justify-end">
            <Switch
              checked={account.isActive}
              onCheckedChange={onToggleActive}
              aria-label="Toggle tracking"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onSync}
              disabled={syncing}
              title="Sync now"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title="Delete"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
