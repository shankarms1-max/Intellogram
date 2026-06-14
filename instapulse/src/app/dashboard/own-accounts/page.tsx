"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
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
  AlertTriangle,
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

interface OwnAccount {
  id: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  status: string;
  lastSyncedAt: string | null;
  isActive: boolean;
  instagramUserId: string | null;
  connectionId: string | null;
  hasConnection: boolean;
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

// ─── Inner page (needs searchParams) ─────────────────────────────────────────

function OwnAccountsInner() {
  const searchParams = useSearchParams();
  const newConnection = searchParams.get("new_connection") === "true";
  const connectedCount = searchParams.get("connected");

  const [assets, setAssets] = useState<DiscoveredAsset[]>([]);
  const [ownAccounts, setOwnAccounts] = useState<OwnAccount[]>([]);
  const [primary, setPrimary] = useState<PrimaryDiscovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Per-asset/account action state: key → "adding"|"removing"|"syncing"
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [assetsRes, primaryRes] = await Promise.all([
        fetch("/api/meta/discovered-assets"),
        fetch("/api/meta/primary-discovery"),
      ]);

      if (!assetsRes.ok) {
        const body = await assetsRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `API error ${assetsRes.status}`);
      }

      const data = await assetsRes.json() as {
        assets: DiscoveredAsset[];
        ownAccounts: OwnAccount[];
        orphanPages: unknown[];
        _diag?: Record<string, unknown>;
      };

      setAssets(data.assets ?? []);
      setOwnAccounts(data.ownAccounts ?? []);

      if (primaryRes.ok) {
        const primaryData = await primaryRes.json() as PrimaryDiscovery;
        setPrimary(primaryData);
      }
    } catch (e: unknown) {
      setApiError(
        e instanceof Error
          ? e.message
          : "Could not load Meta assets. Please check server logs or reconnect Meta."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  function setAction(key: string, action: string | null) {
    setActionLoading((prev) => {
      const next = { ...prev };
      if (action) next[key] = action;
      else delete next[key];
      return next;
    });
  }

  async function handleAddAsOwn(instagramUsername: string) {
    setAction(instagramUsername, "adding");
    setActionError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: instagramUsername, accountType: "own" }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) throw new Error(d.error || "Failed to add account");
      await fetchData();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not add account");
    } finally {
      setAction(instagramUsername, null);
    }
  }

  async function handleRemoveFromOwn(accountId: string, key: string) {
    setAction(key, "removing");
    setActionError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: "other" }),
      });
      if (!res.ok) throw new Error("Failed to update account");
      await fetchData();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not remove account");
    } finally {
      setAction(key, null);
    }
  }

  async function handleMoveToCompetitor(accountId: string, key: string) {
    setAction(key, "moving");
    setActionError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: "competitor" }),
      });
      if (!res.ok) throw new Error("Failed to move account");
      await fetchData();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not move account");
    } finally {
      setAction(key, null);
    }
  }

  async function handleSync(accountId: string, key: string) {
    setAction(key, "syncing");
    setActionError(null);
    try {
      await fetch(`/api/accounts/${accountId}/sync`, { method: "POST" });
      await fetchData();
    } catch {
      // silently ignore
    } finally {
      setAction(key, null);
    }
  }

  async function handleSetPrimary(instagramUserId: string) {
    setActionError(null);
    try {
      const res = await fetch("/api/meta/primary-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramUserId }),
      });
      if (!res.ok) throw new Error("Failed to set primary account");
      await fetchData();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not set primary account");
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  // Own accounts that have a matching active connection (shown in Section 1 toggle)
  const assetsWithOwn = assets.filter((a) => a.trackedAccount !== null);
  // Connections that have no own account yet
  const assetsWithoutOwn = assets.filter((a) => a.trackedAccount === null && a.status === "active");
  // Own accounts not discoverable from any Meta OAuth connection — unauthorized
  const unauthorizedOwnAccounts = ownAccounts.filter((a) => !a.hasConnection);
  // Authorized own accounts (have matching OAuth connection)
  const authorizedOwnAccounts = ownAccounts.filter((a) => a.hasConnection);

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
      {newConnection && !loading && !apiError && (
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

      {/* Action-level errors */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
          <Button variant="ghost" size="sm" onClick={() => setActionError(null)} className="ml-auto text-red-600">
            Dismiss
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading connected accounts…</span>
        </div>
      ) : apiError ? (
        /* ─── Full API failure state ─── */
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-4">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Could not load Meta assets</p>
              <p className="text-xs text-red-700 mt-1">{apiError}</p>
              <p className="text-xs text-red-600 mt-1">
                Check server logs for details. If the issue persists, try reconnecting your Meta account.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchData} className="shrink-0">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          </div>
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
                Instagram accounts discovered from your Meta OAuth authorization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  No OAuth connections found.{" "}
                  <a href="/dashboard/connect" className="text-violet-600 hover:underline">
                    Connect your Meta account
                  </a>{" "}
                  to link Instagram accounts via OAuth.
                  {ownAccounts.length > 0 && (
                    <p className="mt-1 text-xs">
                      Your existing tracked accounts are listed in Own Instagram Accounts below.
                    </p>
                  )}
                </div>
              ) : (
                assets.map((asset, idx) => {
                  const action = actionLoading[asset.instagramUsername];
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
                              onClick={() => handleRemoveFromOwn(asset.trackedAccount!.id, asset.instagramUsername)}
                              disabled={!!action}
                              className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                            >
                              {action === "removing"
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <MinusCircle className="h-3.5 w-3.5" />}
                              Remove
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddAsOwn(asset.instagramUsername)}
                              disabled={!!action}
                              className="text-violet-700 border-violet-200 hover:bg-violet-50 text-xs"
                            >
                              {action === "adding"
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <PlusCircle className="h-3.5 w-3.5" />}
                              Add as Own
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {assetsWithoutOwn.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 mt-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    {assetsWithoutOwn.length} connected account{assetsWithoutOwn.length > 1 ? "s are" : " is"} not
                    tracked as own. Click &quot;Add as Own&quot; above to monitor {assetsWithoutOwn.length > 1 ? "them" : "it"}.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={fetchData} className="text-xs text-muted-foreground">
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

              {/* Unauthorized own accounts warning */}
              {unauthorizedOwnAccounts.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    {unauthorizedOwnAccounts.length > 1
                      ? `${unauthorizedOwnAccounts.length} accounts are`
                      : "1 account is"}{" "}
                    not linked to any Meta OAuth connection. Own accounts must come from your connected Meta assets.{" "}
                    <a href="/dashboard/connect" className="underline">
                      Reconnect Meta
                    </a>{" "}
                    to authorize, or move these to competitors using the button below.
                  </p>
                </div>
              )}

              {ownAccounts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  No own accounts are being tracked.
                  {assets.length > 0 ? (
                    <> Add an account from Connected Meta Assets above.</>
                  ) : (
                    <>
                      {" "}
                      <a href="/dashboard/connect" className="text-violet-600 hover:underline">
                        Connect your Meta account
                      </a>{" "}
                      to get started.
                    </>
                  )}
                </div>
              ) : (
                ownAccounts.map((ta, idx) => {
                  const key = ta.id;
                  const action = actionLoading[key];
                  const isPrimary = primary?.instagramUserId === ta.instagramUserId;
                  const lastSynced = ta.lastSyncedAt
                    ? new Date(ta.lastSyncedAt).toLocaleDateString()
                    : "Never";

                  return (
                    <div key={ta.id}>
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
                            {!ta.hasConnection ? (
                              <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" /> Needs authorization
                              </Badge>
                            ) : null}
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
                          {!ta.hasConnection ? (
                            /* Unauthorized: show Move to Competitor and reconnect hint */
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMoveToCompetitor(ta.id, key)}
                                disabled={!!action}
                                className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                                title="Move to competitor tracking"
                              >
                                {action === "moving"
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <RotateCw className="h-3.5 w-3.5" />}
                                Move to Competitor
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveFromOwn(ta.id, key)}
                                disabled={!!action}
                                className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                              >
                                {action === "removing"
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <MinusCircle className="h-3.5 w-3.5" />}
                                Remove
                              </Button>
                            </>
                          ) : (
                            /* Authorized: full action set */
                            <>
                              {!isPrimary && ta.instagramUserId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetPrimary(ta.instagramUserId!)}
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
                                onClick={() => handleSync(ta.id, key)}
                                disabled={!!action}
                                title="Sync now"
                              >
                                {action === "syncing"
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <RotateCw className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveFromOwn(ta.id, key)}
                                disabled={!!action}
                                className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                              >
                                {action === "removing"
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <MinusCircle className="h-3.5 w-3.5" />}
                                Remove
                              </Button>
                            </>
                          )}
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
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(primary.followersCount)} followers
                      </p>
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
                    No primary discovery account set. The most recently active connection will be used automatically.
                    Set a primary account below for consistent competitor tracking.
                  </p>
                </div>
              )}

              {authorizedOwnAccounts.filter((a) => a.instagramUserId).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Change primary account</p>
                    <div className="space-y-1.5">
                      {authorizedOwnAccounts.filter((a) => a.instagramUserId).map((ta) => {
                        const isPrimary = primary?.instagramUserId === ta.instagramUserId;
                        return (
                          <div
                            key={ta.id}
                            className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                              isPrimary
                                ? "border-yellow-200 bg-yellow-50"
                                : "border-border bg-background hover:bg-muted/50 cursor-pointer"
                            }`}
                            onClick={() => !isPrimary && handleSetPrimary(ta.instagramUserId!)}
                          >
                            <Avatar username={ta.username} pictureUrl={ta.profilePictureUrl} size={7} />
                            <span className="text-sm flex-1">@{ta.username}</span>
                            {isPrimary
                              ? <Star className="h-4 w-4 text-yellow-600 shrink-0" />
                              : <StarOff className="h-4 w-4 text-muted-foreground shrink-0" />}
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

// ─── Page wrapper with Suspense for useSearchParams ───────────────────────────

export default function OwnAccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      }
    >
      <OwnAccountsInner />
    </Suspense>
  );
}
