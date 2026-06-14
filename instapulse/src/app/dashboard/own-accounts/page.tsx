"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Aperture,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  Star,
  StarOff,
  RotateCw,
  PlusCircle,
  MinusCircle,
  Info,
  Globe,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatNumber } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FacebookPageRef {
  id: string;
  facebookPageId: string;
  name: string;
  pictureUrl?: string | null;
  category?: string | null;
}

interface TrackedAccountRef {
  id: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  status: string;
  lastSyncedAt: string | null;
  isActive: boolean;
}

interface DiscoveredAsset {
  connectionId: string;
  instagramUserId: string;
  instagramUsername: string;
  status: string;
  tokenExpiresAt: string | null;
  scopes: string[];
  updatedAt: string;
  trackedAccount: TrackedAccountRef | null;
  facebookPage: FacebookPageRef | null;
}

interface PrimaryDiscovery {
  instagramUserId: string | null;
  instagramUsername: string | null;
  displayName?: string | null;
  profilePictureUrl?: string | null;
  followersCount?: number | null;
  trackedAccountId?: string | null;
  source: string | null;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ConnectionStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
        <CheckCircle2 className="h-3 w-3" /> Active
      </Badge>
    );
  }
  if (status === "disconnected") {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs gap-1">
        <XCircle className="h-3 w-3" /> Disconnected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs gap-1">
      <Clock className="h-3 w-3" /> {status}
    </Badge>
  );
}

function Avatar({ username, pictureUrl, size = 10 }: { username: string; pictureUrl?: string | null; size?: number }) {
  const sizeClass = `h-${size} w-${size}`;
  if (pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pictureUrl}
        alt={username}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0`}>
      {username[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnAccountsPage() {
  const searchParams = useSearchParams();
  const newConnection = searchParams.get("new_connection") === "true";
  const connectedCount = searchParams.get("connected");

  const [assets, setAssets] = useState<DiscoveredAsset[]>([]);
  const [primary, setPrimary] = useState<PrimaryDiscovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-asset action state
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({}); // connectionId → action

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetsRes, primaryRes] = await Promise.all([
        fetch("/api/meta/discovered-assets"),
        fetch("/api/meta/primary-discovery"),
      ]);
      if (!assetsRes.ok) throw new Error("Failed to load connected assets");
      const assetsData = await assetsRes.json() as { assets: DiscoveredAsset[] };
      setAssets(assetsData.assets ?? []);

      if (primaryRes.ok) {
        const primaryData = await primaryRes.json() as PrimaryDiscovery;
        setPrimary(primaryData);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function handleAddAsOwn(asset: DiscoveredAsset) {
    setActionLoading((prev) => ({ ...prev, [asset.connectionId]: "adding" }));
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: asset.instagramUsername,
          accountType: "own",
          displayName: asset.instagramUsername,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error || "Failed to add account");
      }
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add account");
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[asset.connectionId]; return n; });
    }
  }

  async function handleRemoveFromOwn(asset: DiscoveredAsset) {
    if (!asset.trackedAccount) return;
    setActionLoading((prev) => ({ ...prev, [asset.connectionId]: "removing" }));
    try {
      const res = await fetch(`/api/accounts/${asset.trackedAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: "other" }),
      });
      if (!res.ok) throw new Error("Failed to update account");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not remove account");
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[asset.connectionId]; return n; });
    }
  }

  async function handleSync(asset: DiscoveredAsset) {
    if (!asset.trackedAccount) return;
    setActionLoading((prev) => ({ ...prev, [asset.connectionId]: "syncing" }));
    try {
      await fetch(`/api/accounts/${asset.trackedAccount.id}/sync`, { method: "POST" });
      await fetchData();
    } catch {
      // silently ignore
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[asset.connectionId]; return n; });
    }
  }

  async function handleSetPrimary(instagramUserId: string) {
    try {
      const res = await fetch("/api/meta/primary-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramUserId }),
      });
      if (!res.ok) throw new Error("Failed to set primary account");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not set primary account");
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const ownAssets = assets.filter((a) => a.trackedAccount !== null);
  const untracked = assets.filter((a) => a.trackedAccount === null && a.status === "active");

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Own Instagram Accounts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your workspace can track multiple own Instagram accounts. Connect Meta once, then choose which client accounts to monitor.
        </p>
      </div>

      {/* New connection banner */}
      {newConnection && (
        <div className="flex items-start gap-3 rounded-lg bg-violet-50 border border-violet-200 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-violet-800">
              Meta connected — {connectedCount} Instagram account{connectedCount !== "1" ? "s" : ""} discovered
            </p>
            <p className="text-xs text-violet-700 mt-0.5">
              All discovered accounts have been added as own accounts below. Remove any you don&apos;t want to track.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-700">
            Dismiss
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading connected accounts…</span>
        </div>
      ) : (
        <>
          {/* ─── Section 1: Connected Meta Assets ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Aperture className="h-4 w-4" />
                Connected Meta Assets
              </CardTitle>
              <CardDescription>
                All Instagram accounts discovered from your Meta authorization. Each represents an active OAuth connection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No Meta connections found.{" "}
                  <a href="/dashboard/connect" className="text-violet-600 hover:underline">
                    Connect your Meta account
                  </a>{" "}
                  to get started.
                </div>
              ) : (
                assets.map((asset, idx) => {
                  const action = actionLoading[asset.connectionId];
                  const isOwn = asset.trackedAccount !== null;
                  const expiry = asset.tokenExpiresAt
                    ? new Date(asset.tokenExpiresAt).toLocaleDateString()
                    : null;

                  return (
                    <div key={asset.connectionId}>
                      {idx > 0 && <Separator className="my-3" />}
                      <div className="flex items-center gap-3">
                        <Avatar
                          username={asset.instagramUsername}
                          pictureUrl={asset.trackedAccount?.profilePictureUrl}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">@{asset.instagramUsername}</span>
                            <ConnectionStatusBadge status={asset.status} />
                            {isOwn && (
                              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                                Tracked as own
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            {asset.facebookPage && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {asset.facebookPage.name}
                              </span>
                            )}
                            {expiry && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Token expires {expiry}
                              </span>
                            )}
                            {asset.trackedAccount?.followersCount != null && (
                              <span>{formatNumber(asset.trackedAccount.followersCount)} followers</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOwn ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveFromOwn(asset)}
                              disabled={!!action}
                              className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                            >
                              {action === "removing" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MinusCircle className="h-3.5 w-3.5" />
                              )}
                              Remove
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddAsOwn(asset)}
                              disabled={!!action}
                              className="text-violet-700 border-violet-200 hover:bg-violet-50 text-xs"
                            >
                              {action === "adding" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PlusCircle className="h-3.5 w-3.5" />
                              )}
                              Add as Own
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {untracked.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 mt-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    {untracked.length} connected account{untracked.length > 1 ? "s are" : " is"} not being tracked as own.
                    Click &quot;Add as Own&quot; above to include {untracked.length > 1 ? "them" : "it"} in your workspace.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ─── Section 2: Own Instagram Accounts ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Own Instagram Accounts
              </CardTitle>
              <CardDescription>
                Accounts actively tracked as your own. Sync to fetch latest profile and media data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ownAssets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No own accounts are being tracked. Add accounts from Connected Meta Assets above.
                </div>
              ) : (
                ownAssets.map((asset, idx) => {
                  const ta = asset.trackedAccount!;
                  const action = actionLoading[asset.connectionId];
                  const isPrimary = primary?.instagramUserId === asset.instagramUserId;
                  const lastSynced = ta.lastSyncedAt
                    ? new Date(ta.lastSyncedAt).toLocaleDateString()
                    : "Never";

                  return (
                    <div key={asset.connectionId}>
                      {idx > 0 && <Separator className="my-3" />}
                      <div className="flex items-start gap-3">
                        <Avatar username={ta.username} pictureUrl={ta.profilePictureUrl} size={10} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">@{ta.username}</span>
                            {ta.displayName && (
                              <span className="text-xs text-muted-foreground">· {ta.displayName}</span>
                            )}
                            {isPrimary && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs gap-1">
                                <Star className="h-3 w-3" /> Primary
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            {ta.followersCount != null && (
                              <span>{formatNumber(ta.followersCount)} followers</span>
                            )}
                            {ta.mediaCount != null && (
                              <span>{formatNumber(ta.mediaCount)} posts</span>
                            )}
                            <span>Last synced: {lastSynced}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {!isPrimary && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetPrimary(asset.instagramUserId)}
                              className="text-xs text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                              title="Set as primary account for competitor discovery"
                            >
                              <StarOff className="h-3.5 w-3.5" />
                              Set Primary
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSync(asset)}
                            disabled={!!action}
                            title="Sync now"
                          >
                            {action === "syncing" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFromOwn(asset)}
                            disabled={!!action}
                            className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                          >
                            {action === "removing" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MinusCircle className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* ─── Section 3: Competitor Discovery Account ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4" />
                Competitor Discovery Account
              </CardTitle>
              <CardDescription>
                Competitor tracking uses one of your connected own Instagram professional accounts as the query source for Business Discovery API calls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {primary?.instagramUserId ? (
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
                  <Avatar
                    username={primary.instagramUsername ?? "?"}
                    pictureUrl={primary.profilePictureUrl}
                    size={10}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">@{primary.instagramUsername}</p>
                    {primary.displayName && (
                      <p className="text-xs text-muted-foreground">{primary.displayName}</p>
                    )}
                    {primary.followersCount != null && (
                      <p className="text-xs text-muted-foreground">{formatNumber(primary.followersCount)} followers</p>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs gap-1 shrink-0">
                    <Star className="h-3 w-3" /> Primary
                  </Badge>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    No primary discovery account set. The most recently updated active connection will be used automatically.
                    Set a primary account above for consistent competitor tracking.
                  </p>
                </div>
              )}

              {ownAssets.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Change primary account</p>
                    <div className="space-y-1.5">
                      {ownAssets.map((asset) => {
                        const ta = asset.trackedAccount!;
                        const isPrimary = primary?.instagramUserId === asset.instagramUserId;
                        return (
                          <div
                            key={asset.connectionId}
                            className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                              isPrimary
                                ? "border-yellow-200 bg-yellow-50"
                                : "border-border bg-background hover:bg-muted/50 cursor-pointer"
                            }`}
                            onClick={() => !isPrimary && handleSetPrimary(asset.instagramUserId)}
                          >
                            <Avatar username={ta.username} pictureUrl={ta.profilePictureUrl} size={7} />
                            <span className="text-sm flex-1">@{ta.username}</span>
                            {isPrimary ? (
                              <Star className="h-4 w-4 text-yellow-600 shrink-0" />
                            ) : (
                              <StarOff className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
