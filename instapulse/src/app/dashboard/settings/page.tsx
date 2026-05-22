"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Settings,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Info,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

function StatusIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <Badge
        variant="outline"
        className={
          ok
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs ml-auto"
            : "bg-red-50 text-red-600 border-red-200 text-xs ml-auto"
        }
      >
        {ok ? "Configured" : "Not set"}
      </Badge>
    </div>
  );
}

export default function SettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceSuccess, setWorkspaceSuccess] = useState(false);

  // UI-only sync preferences (not persisted)
  const [autoSync, setAutoSync] = useState(false);
  const [syncNotifications, setSyncNotifications] = useState(true);

  const fetchWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const res = await fetch("/api/workspace");
      if (!res.ok) throw new Error("Failed to load workspace");
      const data: Workspace = await res.json();
      setWorkspace(data);
      setWorkspaceName(data.name);
    } catch {
      // silently handle — user can retry
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  async function handleSaveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setSavingWorkspace(true);
    setWorkspaceError(null);
    setWorkspaceSuccess(false);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save workspace");
      setWorkspace(data);
      setWorkspaceName(data.name);
      setWorkspaceSuccess(true);
      setTimeout(() => setWorkspaceSuccess(false), 3000);
    } catch (e: unknown) {
      setWorkspaceError(e instanceof Error ? e.message : "Could not save workspace settings");
    } finally {
      setSavingWorkspace(false);
    }
  }

  // API config status is read from env vars at build time — approximate from what's visible
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/meta/callback`
      : "/api/auth/meta/callback";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your workspace and application settings.
        </p>
      </div>

      {/* Workspace Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Workspace
          </CardTitle>
          <CardDescription>
            Configure your workspace name and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingWorkspace ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading workspace…
            </div>
          ) : (
            <form onSubmit={handleSaveWorkspace} className="space-y-4">
              {workspaceError && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {workspaceError}
                </div>
              )}
              {workspaceSuccess && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Workspace settings saved.
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Workspace"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This name is used throughout the dashboard.
                </p>
              </div>
              {workspace && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Workspace ID: <span className="font-mono">{workspace.id}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(workspace.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}
              <Button type="submit" size="sm" disabled={savingWorkspace}>
                {savingWorkspace && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Sync Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Sync Preferences
          </CardTitle>
          <CardDescription>
            Configure default sync behavior. These settings are local to your session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Auto-sync on load</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically sync accounts when the dashboard loads.
              </p>
            </div>
            <Switch
              checked={autoSync}
              onCheckedChange={setAutoSync}
              aria-label="Toggle auto-sync"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sync notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show a notification when a sync job completes.
              </p>
            </div>
            <Switch
              checked={syncNotifications}
              onCheckedChange={setSyncNotifications}
              aria-label="Toggle sync notifications"
            />
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Sync preferences are stored locally and not persisted to the database.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            API Connection Status
          </CardTitle>
          <CardDescription>
            Meta (Instagram) API configuration status for this deployment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusIndicator
            ok={Boolean(process.env.NEXT_PUBLIC_META_APP_ID)}
            label="Meta App ID"
          />
          <Separator />
          <StatusIndicator
            ok={false /* secret not exposed to client */}
            label="Meta App Secret"
          />
          <Separator />
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">OAuth Redirect URI</p>
            <p className="text-xs font-mono bg-muted rounded px-2 py-1.5 break-all">
              {redirectUri}
            </p>
            <p className="text-xs text-muted-foreground">
              Add this URL to your Meta App&apos;s Valid OAuth Redirect URIs.
            </p>
          </div>
          <Separator />
          <div className="flex items-center gap-2 text-sm">
            {isDemoMode ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Demo Mode is <strong>active</strong> — using mock data.</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs ml-auto">
                  Demo
                </Badge>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Demo Mode is <strong>off</strong> — live API enabled.</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs ml-auto">
                  Live
                </Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Members
          </CardTitle>
          <CardDescription>
            Invite teammates to collaborate on this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Team collaboration coming soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-user workspaces will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Billing & Plan
          </CardTitle>
          <CardDescription>
            Manage your subscription and billing information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <Zap className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Billing management coming soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              Subscription tiers and billing will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your workspace data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Demo Data Reset</p>
              <p className="text-xs text-red-600 mt-0.5">
                This workspace will be cleared on demo reset. All tracked accounts, media, and
                reports will be permanently deleted. This action cannot be undone.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled
            title="Not available in this version"
          >
            Reset Workspace Data
          </Button>
          <p className="text-xs text-muted-foreground">
            Contact support to permanently delete your workspace.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
