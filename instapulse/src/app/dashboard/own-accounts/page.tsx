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
  User,
  Link2Off,
  Link2,
  ExternalLink,
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
  source: "instagram_connection" | "facebook_page";
  isAuthorized: true;
  connectionId: string | null;
  facebookUserId: string | null;
  facebookUserName: string | null;
  instagramUserId: string;
  instagramUsername: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  status: string;
  tokenExpiresAt: string | null;
  scopes: string[];
  updatedAt: string;
  isTrackedAsOwn: boolean;
  trackedAccountId: string | null;
  trackedAccount: TrackedAccountRef | null;
  facebookPage: FacebookPageRef | null;
}

interface ConnectionInGroup {
  id: string;
  instagramUserId: string;
  instagramUsername: string;
  status: string;
  tokenExpiresAt: string | null;
  updatedAt: string;
}

interface GroupedConnection {
  groupKey: string;
  facebookUserId: string | null;
  facebookUserName: string | null;
  connections: ConnectionInGroup[];
  assets: DiscoveredAsset[];
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
  const reconnectedExisting = searchParams.get("reconnected_existing") === "true";
  const newMetaIdentity = searchParams.get("new_meta_identity") === "true";
  const connectedCount = searchParams.get("connected");

  const [assets, setAssets] = useState<DiscoveredAsset[]>([]);
  const [groupedConnections, setGroupedConnections] = useState<GroupedConnection[]>([]);
  const [ownAccounts, setOwnAccounts] = useState<OwnAccount[]>([]);
  const [primary, setPrimary] = useState<PrimaryDiscovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [diag, setDiag] = useState<{
    connectionsFound: number;
    pagesFound: number;
    assetsFound: number;
    ownAccountsFound: number;
    assetsNotTrackedAsOwn: number;
    activeConnectionsFound: number;
    metaIdentitiesFound: number;
    errors: string[];
  } | null>(null);

  // Per-asset/account action state: key → "adding"|"removing"|"syncing"|"disconnecting"
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [connectAnotherLoading, setConnectAnotherLoading] = useState(false);
  const [connectAnotherError, setConnectAnotherError] = useState<string | null>(null);

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
        groupedConnections?: GroupedConnection[];
        ownAccounts: OwnAccount[];
        orphanPages: unknown[];
        _diag?: {
          connectionsFound?: number;
          pagesFound?: number;
          assetsFound?: number;
          ownAccountsFound?: number;
          assetsNotTrackedAsOwn?: number;
          activeConnectionsFound?: number;
          metaIdentitiesFound?: number;
          errors?: string[];
        };
      };

      setAssets(data.assets ?? []);
      setGroupedConnections(data.groupedConnections ?? []);
      setOwnAccounts(data.ownAccounts ?? []);
      if (data._diag) {
        setDiag({
          connectionsFound: data._diag.connectionsFound ?? 0,
          pagesFound: data._diag.pagesFound ?? 0,
          assetsFound: data._diag.assetsFound ?? (data.assets?.length ?? 0),
          ownAccountsFound: data._diag.ownAccountsFound ?? 0,
          assetsNotTrackedAsOwn: data._diag.assetsNotTrackedAsOwn ?? 0,
          activeConnectionsFound: data._diag.activeConnectionsFound ?? 0,
          metaIdentitiesFound: data._diag.metaIdentitiesFound ?? 0,
          errors: data._diag.errors ?? [],
        });
      }

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

  async function handleAddAsOwn(asset: DiscoveredAsset) {
    const key = asset.instagramUserId || asset.instagramUsername;
    setAction(key, "adding");
    setActionError(null);
    try {
      const res = await fetch("/api/meta/own-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramUserId: asset.instagramUserId,
          username: asset.instagramUsername,
          connectionId: asset.connectionId ?? undefined,
          displayName: asset.displayName ?? undefined,
          profilePictureUrl: asset.profilePictureUrl ?? undefined,
        }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) throw new Error(d.error || "Failed to add account");
      await fetchData();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not add account");
    } finally {
      setAction(key, null);
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

  async function handleConnectAnother() {
    setConnectAnotherLoading(true);
    setConnectAnotherError(null);
    try {
      const res = await fetch("/api/auth/meta/start?force_reauth=1&connect_another=1");
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Could not start Meta connection");
      }
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } catch (e: unknown) {
      setConnectAnotherError(e instanceof Error ? e.message : "Could not start Meta connection");
      setConnectAnotherLoading(false);
    }
  }

  async function handleDisconnectGroup(group: GroupedConnection) {
    const groupKey = group.groupKey;
    setAction(groupKey, "disconnecting");
    setActionError(null);
    try {
      // Disconnect each connection in the group
      await Promise.all(
        group.connections.map((conn) =>
          fetch(
            `/api/instagram/connections?instagramUserId=${encodeURIComponent(conn.instagramUserId)}`,
            { method: "DELETE" }
          )
        )
      );
      await fetchData();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not disconnect Meta connection");
    } finally {
      setAction(groupKey, null);
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const assetsWithOwn = assets.filter((a) => a.isTrackedAsOwn);
  const assetsWithoutOwn = assets.filter((a) => !a.isTrackedAsOwn && a.status !== "disconnected");
  const unauthorizedOwnAccounts = ownAccounts.filter((a) => !a.hasConnection);
  const authorizedOwnAccounts = ownAccounts.filter((a) => a.hasConnection);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Own Instagram Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect one or more Meta accounts to discover Instagram Business and Creator accounts you manage.
            Choose which client accounts to track as own in this workspace.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleConnectAnother}
          disabled={connectAnotherLoading}
          className="shrink-0 gap-1.5 text-xs"
        >
          {connectAnotherLoading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Link2 className="h-3.5 w-3.5" />}
          Connect another Meta account
        </Button>
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
              {Number(connectedCount) > 1
                ? "We found multiple Instagram accounts. Use the Add as Own button below to choose which client accounts to track."
                : "Your account has been connected and added as an own account."}
            </p>
          </div>
        </div>
      )}

      {/* Same Meta identity reconnected */}
      {reconnectedExisting && !loading && !apiError && (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              This Meta account is already connected
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Facebook authenticated the same identity that&apos;s already linked to this workspace — your token and assets have been refreshed.
              To add a <strong>different</strong> Facebook account, choose another Facebook profile during login or use an incognito window.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleConnectAnother}
                disabled={connectAnotherLoading}
                className="text-xs text-amber-800 underline hover:no-underline disabled:opacity-50"
              >
                {connectAnotherLoading ? "Starting…" : "Try again"}
              </button>
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Or open in an incognito window and log into a different Facebook account first
              </span>
            </div>
          </div>
        </div>
      )}

      {/* New Meta identity connected */}
      {newMetaIdentity && !loading && !apiError && (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              New Meta account connected — {connectedCount} Instagram account{connectedCount !== "1" ? "s" : ""} discovered
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              A new Meta authorization group now appears below. Use <strong>Add as Own</strong> to choose which accounts to track.
            </p>
          </div>
        </div>
      )}

      {/* Connect Another error */}
      {connectAnotherError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {connectAnotherError}
          <Button variant="ghost" size="sm" onClick={() => setConnectAnotherError(null)} className="ml-auto text-red-600">
            Dismiss
          </Button>
        </div>
      )}

      {/* ─── Debug counts panel ─── */}
      {!loading && diag && (
        <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-0.5">
          <p className="font-medium text-foreground text-xs mb-1">Meta Assets Diagnostic</p>
          <p>Meta identities (authorizing users): <span className="font-mono font-semibold text-foreground">{diag.metaIdentitiesFound}</span></p>
          <p>Active OAuth connections: <span className="font-mono font-semibold text-foreground">{diag.activeConnectionsFound}</span></p>
          <p>Facebook Pages found: <span className="font-mono font-semibold text-foreground">{diag.pagesFound}</span></p>
          <p>Instagram assets found: <span className="font-mono font-semibold text-foreground">{diag.assetsFound}</span></p>
          <p>Own accounts found: <span className="font-mono font-semibold text-foreground">{diag.ownAccountsFound}</span></p>
          <p>Assets available to add as own: <span className="font-mono font-semibold text-foreground">{diag.assetsNotTrackedAsOwn}</span></p>
          {diag.errors.length > 0 && (
            <p className="text-red-600 mt-1">Errors: {diag.errors.join("; ")}</p>
          )}
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
                Instagram Business/Creator accounts discovered from your Meta OAuth authorizations,
                grouped by the Meta account that authorized them.
                Use <strong>Add as Own</strong> to track an account, or <strong>Remove</strong> to stop tracking it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground px-4">
                  <p className="font-medium text-foreground mb-1">No authorized Instagram assets found</p>
                  <p>
                    <a href="/dashboard/connect" className="text-violet-600 hover:underline">
                      Connect a Meta account
                    </a>{" "}
                    and make sure your Instagram Business or Creator account is linked to a Facebook Page.
                  </p>
                  {ownAccounts.length > 0 && (
                    <p className="mt-2 text-xs">
                      Existing tracked accounts are listed in Own Instagram Accounts below.
                    </p>
                  )}
                </div>
              ) : groupedConnections.length > 0 ? (
                /* Grouped view — one section per Meta identity */
                <div className="space-y-5">
                  {groupedConnections.map((group, gIdx) => {
                    const groupAction = actionLoading[group.groupKey];
                    const earliestExpiry = group.connections
                      .map((c) => c.tokenExpiresAt)
                      .filter(Boolean)
                      .sort()[0];
                    const expiryDate = earliestExpiry
                      ? new Date(earliestExpiry).toLocaleDateString()
                      : null;
                    const allDisconnected = group.connections.every((c) => c.status === "disconnected");
                    const groupLabel = group.facebookUserName
                      ? group.facebookUserName
                      : group.connections.length === 1
                      ? `@${group.connections[0].instagramUsername}`
                      : `${group.connections.length} accounts`;

                    return (
                      <div key={group.groupKey}>
                        {gIdx > 0 && <Separator />}
                        {/* Connection identity header */}
                        <div className="flex items-center justify-between gap-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <User className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground">
                                  Connected via {groupLabel}
                                </span>
                                {allDisconnected ? (
                                  <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs gap-1">
                                    <XCircle className="h-3 w-3" /> Disconnected
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Active
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {group.assets.length} Instagram account{group.assets.length !== 1 ? "s" : ""}
                                {expiryDate && ` · Token expires ${expiryDate}`}
                              </p>
                            </div>
                          </div>
                          {!allDisconnected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnectGroup(group)}
                              disabled={!!groupAction}
                              className="text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 gap-1"
                              title="Disconnect this Meta authorization"
                            >
                              {groupAction === "disconnecting"
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Link2Off className="h-3.5 w-3.5" />}
                              Disconnect
                            </Button>
                          )}
                        </div>

                        {/* Assets within this group */}
                        <div className="space-y-2 pl-9">
                          {group.assets.map((asset, idx) => {
                            const assetKey = asset.instagramUserId || asset.instagramUsername;
                            const action = actionLoading[assetKey];

                            return (
                              <div key={asset.connectionId ?? asset.instagramUserId}>
                                {idx > 0 && <Separator className="my-2" />}
                                <div className="flex items-center gap-3">
                                  <Avatar
                                    username={asset.instagramUsername}
                                    pictureUrl={asset.profilePictureUrl ?? asset.trackedAccount?.profilePictureUrl}
                                    size={9}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm">@{asset.instagramUsername}</span>
                                      {asset.source === "instagram_connection" && (
                                        <ConnectionStatusBadge status={asset.status} />
                                      )}
                                      {asset.source === "facebook_page" && (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs gap-1">
                                          <Globe className="h-3 w-3" /> Via Page
                                        </Badge>
                                      )}
                                      {asset.isTrackedAsOwn && (
                                        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                                          Tracked as own
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                                      {asset.facebookPage && (
                                        <span className="flex items-center gap-1">
                                          <Globe className="h-3 w-3" />
                                          {asset.facebookPage.name}
                                        </span>
                                      )}
                                      {(asset.followersCount ?? asset.trackedAccount?.followersCount) != null && (
                                        <span>{formatNumber((asset.followersCount ?? asset.trackedAccount?.followersCount)!)} followers</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {asset.isTrackedAsOwn ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRemoveFromOwn(asset.trackedAccountId!, assetKey)}
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
                                        onClick={() => handleAddAsOwn(asset)}
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
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Flat fallback when groupedConnections not available */
                assets.map((asset, idx) => {
                  const assetKey = asset.instagramUserId || asset.instagramUsername;
                  const action = actionLoading[assetKey];
                  const expiry = asset.tokenExpiresAt
                    ? new Date(asset.tokenExpiresAt).toLocaleDateString()
                    : null;

                  return (
                    <div key={asset.connectionId ?? asset.instagramUserId}>
                      {idx > 0 && <Separator className="my-3" />}
                      <div className="flex items-center gap-3">
                        <Avatar
                          username={asset.instagramUsername}
                          pictureUrl={asset.profilePictureUrl ?? asset.trackedAccount?.profilePictureUrl}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">@{asset.instagramUsername}</span>
                            {asset.source === "instagram_connection" && (
                              <ConnectionStatusBadge status={asset.status} />
                            )}
                            {asset.isTrackedAsOwn && (
                              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                                Tracked as own
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            {expiry && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Token expires {expiry}
                              </span>
                            )}
                            {(asset.followersCount ?? asset.trackedAccount?.followersCount) != null && (
                              <span>{formatNumber((asset.followersCount ?? asset.trackedAccount?.followersCount)!)} followers</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {asset.isTrackedAsOwn ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveFromOwn(asset.trackedAccountId!, assetKey)}
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
                              onClick={() => handleAddAsOwn(asset)}
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

              {/* Status tips */}
              {assets.length > 0 && assetsWithoutOwn.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 mt-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    {assetsWithoutOwn.length} connected account{assetsWithoutOwn.length > 1 ? "s are" : " is"} not yet
                    tracked as own. Click <strong>Add as Own</strong> above to monitor {assetsWithoutOwn.length > 1 ? "them" : "it"}.
                  </p>
                </div>
              )}

              {assets.length > 0 && assetsWithoutOwn.length === 0 && assetsWithOwn.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 mt-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-700">
                    <p className="font-medium">All connected accounts are being tracked as own.</p>
                    <p className="mt-0.5">
                      Click <strong>Remove</strong> on an account to stop tracking it as own.
                      To track additional Instagram accounts,{" "}
                      <a href="/dashboard/connect" className="underline">connect another Meta account</a>.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleConnectAnother}
                    disabled={connectAnotherLoading}
                    className="text-xs text-violet-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {connectAnotherLoading
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Link2 className="h-3 w-3" />}
                    Connect another Meta account
                  </button>
                  <Button variant="ghost" size="sm" onClick={fetchData} className="text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  To add client assets managed under a different Facebook identity, connect another Meta account.
                  Facebook will ask you to re-authenticate — if it reuses the same account,{" "}
                  log out of Facebook first or use an incognito window.
                </p>
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
