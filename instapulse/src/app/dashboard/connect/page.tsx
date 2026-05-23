"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Aperture,
  CheckCircle2,
  XCircle,
  Loader2,
  Unlink,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Info,
  ShieldAlert,
  Key,
  Building2,
  Zap,
  Eye,
  EyeOff,
  Clock,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────

type PagesDiagnosticIssue =
  | "no_token"
  | "page_permissions_granted_but_no_pages_returned"
  | "business_manager_permission_required"
  | "no_issue_detected"
  | "api_error";

interface PagesDiagnostic {
  grantedScopes: string[];
  pagesCount: number;
  businessManagementGranted: boolean;
  businessesAccessible: boolean | null;
  likelyIssue: PagesDiagnosticIssue;
}

type CredentialMode = "managed" | "byok_app" | "byok_token";
type CredentialStatus = "active" | "expired" | "invalid" | "missing_permissions" | "rate_limited" | "unconfigured";

interface CredentialConfig {
  mode: CredentialMode;
  status: CredentialStatus;
  metaAppId: string | null;
  hasMetaAppSecret: boolean;
  hasAccessToken: boolean;
  instagramUserId: string | null;
  instagramUsername: string | null;
  igBusinessAccountId: string | null;
  tokenExpiresAt: string | null;
  tokenScopes: string[];
  lastValidatedAt: string | null;
  validationError: string | null;
  platformMetaConfigured: boolean;
}

interface Connection {
  id: string;
  instagramUserId: string;
  instagramUsername: string;
  status: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<CredentialStatus, { label: string; className: string; icon: React.ReactNode }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  expired: { label: "Expired", className: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="h-3 w-3" /> },
  invalid: { label: "Invalid", className: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  missing_permissions: { label: "Missing Permissions", className: "bg-orange-100 text-orange-700 border-orange-200", icon: <ShieldAlert className="h-3 w-3" /> },
  rate_limited: { label: "Rate Limited", className: "bg-purple-100 text-purple-700 border-purple-200", icon: <AlertTriangle className="h-3 w-3" /> },
  unconfigured: { label: "Not Configured", className: "bg-gray-100 text-gray-600 border-gray-200", icon: <Info className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: CredentialStatus }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.unconfigured;
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success");
  const connectedParam = searchParams.get("connected");
  const errorParam = searchParams.get("error");

  const [credential, setCredential] = useState<CredentialConfig | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingCredential, setLoadingCredential] = useState(true);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [activeTab, setActiveTab] = useState<CredentialMode>("managed");
  const [diagnostic, setDiagnostic] = useState<PagesDiagnostic | null>(null);

  const fetchCredential = useCallback(async () => {
    setLoadingCredential(true);
    try {
      const res = await fetch("/api/workspace/credential");
      if (res.ok) {
        const data: CredentialConfig = await res.json();
        setCredential(data);
        setActiveTab(data.mode);
      }
    } catch {
      // silently handle
    } finally {
      setLoadingCredential(false);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    setLoadingConnections(true);
    try {
      const res = await fetch("/api/instagram/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
      }
    } catch {
      // silently handle
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  const fetchDiagnostic = useCallback(async () => {
    try {
      const res = await fetch("/api/instagram/diagnostics");
      if (res.ok) setDiagnostic(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCredential();
    fetchConnections();
  }, [fetchCredential, fetchConnections]);

  // Fetch diagnostics when: OAuth error occurred, or token exists but no active connections
  useEffect(() => {
    const hasToken = credential?.hasAccessToken;
    const noActiveConnections = !loadingConnections && connections.filter(c => c.status === "active").length === 0;
    if (hasToken && (errorParam || noActiveConnections)) {
      fetchDiagnostic();
    }
  }, [credential, connections, loadingConnections, errorParam, fetchDiagnostic]);

  async function handleDisconnect(instagramUserId: string) {
    await fetch(`/api/instagram/connections?instagramUserId=${encodeURIComponent(instagramUserId)}`, {
      method: "DELETE",
    });
    fetchConnections();
  }

  const activeConnections = connections.filter((c) => c.status === "active");
  const inactiveConnections = connections.filter((c) => c.status !== "active");

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Connect Instagram</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Most users should use <strong>Connect Instagram</strong> below. Agency and enterprise teams can bring their own Meta App for dedicated usage isolation.
        </p>
      </div>

      {/* OAuth callback result banners */}
      {successParam === "true" && (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-emerald-800">Instagram connected successfully!</p>
            {connectedParam && connectedParam !== "0" && (
              <p className="text-emerald-700 mt-0.5">
                {connectedParam} account{Number(connectedParam) !== 1 ? "s" : ""} linked.
              </p>
            )}
          </div>
        </div>
      )}
      {errorParam && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-red-800">Connection failed</p>
            <p className="text-red-700 mt-0.5">{decodeURIComponent(errorParam)}</p>
          </div>
        </div>
      )}

      {/* Pages diagnostic — shown when token exists but no Pages visible */}
      {diagnostic && diagnostic.likelyIssue !== "no_token" && diagnostic.likelyIssue !== "no_issue_detected" && (
        <PagesDiagnosticPanel diagnostic={diagnostic} />
      )}

      {/* API reality notice */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Instagram does not support simple API-key access like YouTube</p>
          <p className="text-blue-700 mt-1 leading-relaxed">
            Meta API access requires <strong>OAuth</strong>, permissions, and a Business/Creator Instagram account linked to a Facebook Page. There is no single server-side API key. For most users, <strong>Connect Instagram</strong> handles everything automatically. Agencies and enterprise teams can use their own Meta App for dedicated usage isolation.
          </p>
        </div>
      </div>

      {/* ─── Credential mode tabs ─── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CredentialMode)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="managed" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" />
            Connect Instagram
          </TabsTrigger>
          <TabsTrigger value="byok_app" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            Use Your Own Meta App
          </TabsTrigger>
          <TabsTrigger value="byok_token" className="gap-1.5 text-xs">
            <Key className="h-3.5 w-3.5" />
            Developer Token Mode
          </TabsTrigger>
        </TabsList>

        {/* ── Mode 1: Managed OAuth ── */}
        <TabsContent value="managed">
          <ManagedOAuthPanel
            credential={credential}
            loadingCredential={loadingCredential}
            onSaved={fetchCredential}
          />
        </TabsContent>

        {/* ── Mode 2: BYOK App ── */}
        <TabsContent value="byok_app">
          <ByokAppPanel
            credential={credential}
            loadingCredential={loadingCredential}
            onSaved={fetchCredential}
          />
        </TabsContent>

        {/* ── Mode 3: BYOK Token ── */}
        <TabsContent value="byok_token">
          <ByokTokenPanel
            credential={credential}
            loadingCredential={loadingCredential}
            onSaved={() => { fetchCredential(); fetchConnections(); }}
          />
        </TabsContent>
      </Tabs>

      {/* ─── Connected accounts ─── */}
      {activeTab !== "byok_token" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Connected Accounts</h2>
            <Button variant="ghost" size="sm" onClick={fetchConnections} disabled={loadingConnections}>
              <RefreshCw className={`h-4 w-4 ${loadingConnections ? "animate-spin" : ""}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          {loadingConnections ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : connections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Aperture className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">No Instagram accounts connected</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use one of the connection modes above to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeConnections.map((conn) => (
                <ConnectionRow key={conn.id} connection={conn} onDisconnect={() => handleDisconnect(conn.instagramUserId)} />
              ))}
              {inactiveConnections.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground pt-2">Disconnected</p>
                  {inactiveConnections.map((conn) => (
                    <ConnectionRow key={conn.id} connection={conn} onDisconnect={() => handleDisconnect(conn.instagramUserId)} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pages diagnostic panel ───────────────────────────────────────────────────

function PagesDiagnosticPanel({ diagnostic }: { diagnostic: PagesDiagnostic }) {
  const isBusinessManagerIssue = diagnostic.likelyIssue === "business_manager_permission_required";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-amber-800">
            {isBusinessManagerIssue
              ? "Pages managed through Meta Business Portfolio"
              : "Facebook login succeeded but no Pages were returned"}
          </p>
          <p className="text-amber-700 mt-0.5 leading-relaxed">
            {isBusinessManagerIssue
              ? "Your Pages may be managed through Meta Business Portfolio. Business Manager fallback requires the optional business_management permission — enable it by setting META_ENABLE_BUSINESS_MANAGER_FALLBACK=true and reconnecting."
              : "Meta granted the page permissions but returned 0 Facebook Pages for this account. Without an API-visible Page the app cannot discover your linked Instagram Business Account ID."}
          </p>
        </div>
      </div>

      {!isBusinessManagerIssue && (
        <div className="space-y-1.5 pl-6">
          <p className="text-xs font-medium text-amber-800">Steps to fix:</p>
          <div className="space-y-1">
            {[
              "Confirm this Facebook account has Full Control or Admin access to the Page (not just Editor or Analyst)",
              "Confirm the Page is the same Page linked to the Instagram Business or Creator account",
              "Confirm the Instagram account is set to Business or Creator (not Personal)",
              "Go to Facebook → Settings → Apps and Websites → remove the old Channel Radar authorization",
              "Return here and click Connect with Instagram again — during the OAuth dialog, explicitly select and allow the Page",
              "If Pages are managed through Meta Business Portfolio, ask your admin to enable Business Manager fallback (META_ENABLE_BUSINESS_MANAGER_FALLBACK=true)",
            ].map((step) => (
              <div key={step} className="flex items-start gap-2 text-xs text-amber-700">
                <span className="shrink-0 mt-0.5">•</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pl-6 pt-1 text-xs text-amber-600 space-y-0.5">
        <p>Granted scopes: <span className="font-mono">{diagnostic.grantedScopes.join(", ") || "none"}</span></p>
        <p>API-visible Pages: <span className="font-mono">{diagnostic.pagesCount}</span></p>
        <p>business_management: <span className="font-mono">{diagnostic.businessManagementGranted ? "granted" : "not granted"}</span></p>
      </div>
    </div>
  );
}

// ─── Mode panels ─────────────────────────────────────────────────────────────

function ManagedOAuthPanel({
  credential,
  loadingCredential,
  onSaved,
}: {
  credential: CredentialConfig | null;
  loadingCredential: boolean;
  onSaved: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<string | null>(null);

  const platformConfigured = credential?.platformMetaConfigured ?? false;
  const isActive = credential?.mode === "managed";

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/meta/start");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not start OAuth");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not start connection");
      setConnecting(false);
    }
  }

  async function handleSetManaged() {
    await fetch("/api/workspace/credential", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "managed" }),
    });
    onSaved();
  }

  async function handleValidate() {
    setValidating(true);
    setValidateResult(null);
    try {
      const res = await fetch("/api/workspace/credential/validate", { method: "POST" });
      const data = await res.json();
      setValidateResult(data.message || (data.valid ? "Valid" : "Invalid"));
    } catch {
      setValidateResult("Validation request failed");
    } finally {
      setValidating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-600" />
            Connect Instagram
          </CardTitle>
          <div className="flex items-center gap-2">
            {isActive && <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">Active mode</Badge>}
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Recommended</Badge>
          </div>
        </div>
        <CardDescription>
          Recommended for most users. Connect your Instagram Business/Creator account using Channel Radar&apos;s managed Meta App. No Meta Developer account required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!platformConfigured && (
          <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm">
            <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-amber-800">
              <p className="font-medium">Platform credentials not configured</p>
              <p className="text-xs mt-0.5 text-amber-700">
                Set <code className="bg-amber-100 px-1 rounded font-mono">META_APP_ID</code> and{" "}
                <code className="bg-amber-100 px-1 rounded font-mono">META_APP_SECRET</code> in{" "}
                <code className="bg-amber-100 px-1 rounded font-mono">.env</code> to enable this mode.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-md bg-muted/50 border border-border px-4 py-3 text-sm space-y-1.5">
          <p className="font-medium flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            Permissions requested via OAuth
          </p>
          <ul className="text-muted-foreground space-y-1 pl-5 list-disc text-xs">
            <li>instagram_basic — read profile &amp; media</li>
            <li>instagram_manage_insights — engagement metrics</li>
            <li>pages_show_list — list connected Facebook Pages</li>
            <li>pages_read_engagement — read Page data</li>
          </ul>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {validateResult && (
          <div className="flex items-center gap-2 rounded-md bg-muted border border-border px-3 py-2 text-sm text-foreground">
            <BadgeCheck className="h-4 w-4 shrink-0 text-violet-600" />
            {validateResult}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {!isActive && (
            <Button size="sm" variant="outline" onClick={handleSetManaged} disabled={loadingCredential}>
              Switch to Managed Mode
            </Button>
          )}
          <Button
            onClick={handleConnect}
            disabled={connecting || !platformConfigured}
            size="sm"
          >
            {connecting ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</> : <><Aperture className="h-4 w-4" /> Connect with Instagram <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-60" /></>}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleValidate} disabled={validating}>
            {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
            Validate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ByokAppPanel({
  credential,
  loadingCredential,
  onSaved,
}: {
  credential: CredentialConfig | null;
  loadingCredential: boolean;
  onSaved: () => void;
}) {
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<string | null>(null);

  const isActive = credential?.mode === "byok_app";
  const hasSavedCreds = isActive && Boolean(credential?.metaAppId);

  useEffect(() => {
    if (isActive && credential?.metaAppId) {
      setAppId(credential.metaAppId);
    }
  }, [isActive, credential]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/workspace/credential", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "byok_app", metaAppId: appId.trim(), metaAppSecret: appSecret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaveSuccess(true);
      setAppSecret("");
      onSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Could not save credentials");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/auth/meta/start");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not start OAuth");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e: unknown) {
      setConnectError(e instanceof Error ? e.message : "Could not start connection");
      setConnecting(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    setValidateResult(null);
    try {
      const res = await fetch("/api/workspace/credential/validate", { method: "POST" });
      const data = await res.json();
      setValidateResult(data.message || (data.valid ? "Valid" : "Invalid"));
    } catch {
      setValidateResult("Validation request failed");
    } finally {
      setValidating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Use Your Own Meta App
          </CardTitle>
          <div className="flex items-center gap-2">
            {isActive && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Active mode</Badge>}
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Agency / Enterprise</Badge>
          </div>
        </div>
        <CardDescription>
          For agencies and enterprise teams that want dedicated Meta API setup, quota isolation, and control over their own Meta App credentials.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Benefits */}
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm space-y-1.5">
          <p className="font-medium text-blue-800">Why agencies and enterprise teams use this mode</p>
          <ul className="text-blue-700 space-y-1 pl-4 list-disc text-xs">
            <li>Dedicated Meta App credentials — quota is isolated from the shared platform app</li>
            <li>You own the OAuth relationship and Meta App permissions</li>
            <li>Suitable for client-owned Meta Business Portfolio setups</li>
            <li>Better control over permission scope and App Review status</li>
            <li>Optional assisted onboarding — we can help configure your Meta Developer App</li>
          </ul>
        </div>

        {/* Competitor metrics warning */}
        <div className="rounded-md bg-orange-50 border border-orange-200 px-4 py-3 text-sm">
          <p className="font-medium text-orange-800 mb-1">This does not unlock additional competitor data</p>
          <p className="text-orange-700 text-xs leading-relaxed">
            Using your own Meta App does not bypass Instagram API restrictions. Competitor private metrics — reach, impressions, saves, shares, story insights, and audience demographics — remain unavailable regardless of which Meta App credentials are used. These are Meta API limitations, not platform limitations.
          </p>
        </div>

        {/* Assisted onboarding */}
        <div className="rounded-md bg-muted/50 border border-border px-4 py-3 text-sm space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            Assisted Meta App onboarding available
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Agency and enterprise onboarding can include assisted Meta API setup. We help configure your Meta Developer App, OAuth redirect URI, required permissions, and first successful sync. Meta App Review approval timelines and outcomes are controlled by Meta and cannot be guaranteed.
          </p>
        </div>

        {/* Client readiness checklist */}
        <details className="rounded-md border border-border">
          <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer select-none flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
            BYO Meta App — readiness checklist
          </summary>
          <div className="px-4 pb-3 pt-1 space-y-1.5">
            {[
              "You have access to a Meta Business Portfolio",
              "You have admin access to the Facebook Page linked to the Instagram account",
              "The Instagram account is a Business or Creator account (not personal)",
              "The Instagram account is linked to the Facebook Page",
              "You can access developers.facebook.com and create or manage a Meta Developer App",
              "You can add OAuth redirect URIs to the Meta App",
              "You can request or approve required permissions (instagram_basic, instagram_manage_insights)",
              "You understand that instagram_manage_insights may require Meta App Review for production use",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                {item}
              </div>
            ))}
          </div>
        </details>

        {/* Prerequisites */}
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
          <p className="font-medium text-amber-800 mb-1">Setup steps</p>
          <ol className="text-amber-700 space-y-1 pl-4 list-decimal text-xs">
            <li>Create a Meta Developer App at <strong>developers.facebook.com</strong></li>
            <li>Add the <strong>Instagram Graph API</strong> product</li>
            <li>Add <code className="font-mono bg-amber-100 px-1 rounded">/api/auth/meta/callback</code> to Valid OAuth Redirect URIs</li>
            <li>Request <code className="font-mono bg-amber-100 px-1 rounded">instagram_manage_insights</code> permission (App Review may be required)</li>
          </ol>
        </div>

        {hasSavedCreds && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            App ID <code className="font-mono">{credential?.metaAppId}</code> is saved.
            Enter new values below to update.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          {saveError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Credentials saved. You can now click &ldquo;Connect with Instagram&rdquo;.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="byok-app-id">Meta App ID</Label>
            <Input
              id="byok-app-id"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="1234567890123456"
              required
            />
            <p className="text-xs text-muted-foreground">
              Found in your Meta App Dashboard → Settings → Basic
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="byok-app-secret">Meta App Secret</Label>
            <div className="relative">
              <Input
                id="byok-app-secret"
                type={showSecret ? "text" : "password"}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder={hasSavedCreds ? "Leave blank to keep existing secret" : "Enter App Secret"}
                required={!hasSavedCreds}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowSecret((s) => !s)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored encrypted at rest. Never exposed to the browser after saving.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button type="submit" size="sm" disabled={saving || loadingCredential}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Credentials"}
            </Button>
            {hasSavedCreds && (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</> : <><Aperture className="h-4 w-4" /> Connect with Instagram <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-60" /></>}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleValidate} disabled={validating}>
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                  Validate
                </Button>
              </>
            )}
          </div>
        </form>

        {connectError && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {connectError}
          </div>
        )}
        {validateResult && (
          <div className="flex items-center gap-2 rounded-md bg-muted border border-border px-3 py-2 text-sm">
            <BadgeCheck className="h-4 w-4 shrink-0 text-violet-600" />
            {validateResult}
          </div>
        )}

        {isActive && credential?.status && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <StatusBadge status={credential.status} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ByokTokenPanel({
  credential,
  loadingCredential,
  onSaved,
}: {
  credential: CredentialConfig | null;
  loadingCredential: boolean;
  onSaved: () => void;
}) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{
    valid: boolean;
    instagramUsername: string | null;
    igBusinessAccountId: string | null;
    scopes: string[];
    expiresAt: string | null;
    accountsConnected: number;
    warning: string | null;
  } | null>(null);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<string | null>(null);
  const [igAccountId, setIgAccountId] = useState("");
  const [savingIgId, setSavingIgId] = useState(false);
  const [igIdSaved, setIgIdSaved] = useState(false);
  const [igIdError, setIgIdError] = useState<string | null>(null);

  const isActive = credential?.mode === "byok_token";
  const hasIgBusinessAccountId = !!(credential?.igBusinessAccountId || saveResult?.igBusinessAccountId);
  const currentIgBusinessAccountId = credential?.igBusinessAccountId ?? null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveResult(null);
    try {
      const res = await fetch("/api/workspace/credential/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Validation failed");
      setSaveResult(data);
      setToken("");
      onSaved();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Could not validate token");
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    setValidateResult(null);
    try {
      const res = await fetch("/api/workspace/credential/validate", { method: "POST" });
      const data = await res.json();
      setValidateResult(data.message || (data.valid ? "Valid" : "Invalid"));
    } catch {
      setValidateResult("Validation request failed");
    } finally {
      setValidating(false);
    }
  }

  async function handleSaveIgAccountId(e: React.FormEvent) {
    e.preventDefault();
    setSavingIgId(true);
    setIgIdError(null);
    setIgIdSaved(false);
    try {
      const res = await fetch("/api/workspace/credential", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igBusinessAccountId: igAccountId.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setIgIdSaved(true);
      setIgAccountId("");
      onSaved();
      setTimeout(() => setIgIdSaved(false), 4000);
    } catch (err: unknown) {
      setIgIdError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingIgId(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-orange-600" />
            Developer Token Mode
          </CardTitle>
          <div className="flex items-center gap-2">
            {isActive && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">Active mode</Badge>}
            <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 text-xs">Advanced / Testing</Badge>
          </div>
        </div>
        <CardDescription>
          Advanced/testing only. Paste a long-lived Meta access token if you understand Meta Graph API tokens, scopes, and expiry. Not recommended for normal production use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning */}
        <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
          <p className="font-medium text-orange-800 mb-1">When to use this</p>
          <ul className="text-orange-700 space-y-1 pl-4 list-disc text-xs">
            <li>Testing or CI environments where OAuth redirects are impractical</li>
            <li>You already have a long-lived token from the Meta Developer console</li>
            <li>Debugging token scopes or expiry issues</li>
          </ul>
          <p className="text-orange-700 text-xs mt-2">
            <strong>Not recommended for production:</strong> tokens expire and must be manually renewed.
            Use Managed OAuth or Your Meta App mode for automated renewal.
          </p>
        </div>

        <div className="rounded-md bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How to get a long-lived access token</p>
          <ol className="pl-4 list-decimal space-y-1">
            <li>Open <strong>Meta for Developers</strong> → your App → Graph API Explorer</li>
            <li>Select your app and generate a User Access Token with the required permissions</li>
            <li>Exchange it for a long-lived token via <code className="font-mono bg-muted px-1 rounded">GET /oauth/access_token?grant_type=fb_exchange_token&hellip;</code></li>
            <li>Paste the long-lived token below</li>
          </ol>
        </div>

        {isActive && credential && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-emerald-800">Token saved</p>
              <StatusBadge status={credential.status} />
            </div>
            {credential.instagramUsername && (
              <p className="text-xs text-emerald-700">
                Linked to: <strong>@{credential.instagramUsername}</strong>
              </p>
            )}
            {credential.tokenExpiresAt && (
              <p className="text-xs text-emerald-700">
                Expires: {new Date(credential.tokenExpiresAt).toLocaleDateString()}
              </p>
            )}
            {credential.tokenScopes.length > 0 && (
              <p className="text-xs text-emerald-700">
                Scopes: {credential.tokenScopes.join(", ")}
              </p>
            )}
            {credential.validationError && (
              <p className="text-xs text-red-600">{credential.validationError}</p>
            )}
            <Button size="sm" variant="ghost" onClick={handleValidate} disabled={validating} className="h-7 text-xs px-2">
              {validating ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Validating…</> : <><BadgeCheck className="h-3 w-3 mr-1" /> Re-validate token</>}
            </Button>
            {validateResult && <p className="text-xs text-muted-foreground">{validateResult}</p>}
          </div>
        )}

        {saveResult && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Token validated and saved
            </p>
            {saveResult.instagramUsername && (
              <p className="text-xs text-emerald-700">Instagram account: @{saveResult.instagramUsername}</p>
            )}
            <p className="text-xs text-emerald-700">
              {saveResult.accountsConnected} account{saveResult.accountsConnected !== 1 ? "s" : ""} linked
            </p>
            {saveResult.scopes.length > 0 && (
              <p className="text-xs text-emerald-700">Scopes: {saveResult.scopes.join(", ")}</p>
            )}
            {saveResult.warning && (
              <p className="text-xs text-amber-700 mt-1">{saveResult.warning}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          {saveError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="byok-token">Long-lived Meta Access Token</Label>
            <Textarea
              id="byok-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAABwzLixnjYBO..."
              rows={3}
              className="font-mono text-xs"
              required
            />
            <p className="text-xs text-muted-foreground">
              Token is validated against the Meta API before saving. Stored encrypted at rest.
              Never transmitted to the browser after save.
            </p>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={saving || loadingCredential}
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Validating…</> : <><BadgeCheck className="h-4 w-4" /> Validate &amp; Save Token</>}
          </Button>
        </form>

        <Separator />

        {/* IG Business Account ID — required for competitor sync */}
        {isActive && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Instagram Business Account ID</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Required for competitor account sync. This is your own Instagram Business or Creator account&apos;s numeric ID (not your Facebook User ID).
              </p>
            </div>

            {hasIgBusinessAccountId ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                IG Business Account ID set: <code className="font-mono">{currentIgBusinessAccountId}</code>
                <span className="text-xs text-emerald-600 ml-1">— competitor sync enabled</span>
              </div>
            ) : (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm space-y-2">
                <p className="font-medium text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No Instagram Business Account linked
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Your token is a Facebook User token with no Instagram Business account connected to your Facebook Pages.
                  Competitor sync requires your own IG Business/Creator account ID as a lookup lens.
                </p>
                <p className="text-xs font-medium text-amber-800">Option A — Link Instagram to your Facebook Page (recommended):</p>
                <ol className="text-xs text-amber-700 pl-4 list-decimal space-y-0.5">
                  <li>Go to your Facebook Page → Settings → Linked Accounts → Instagram → Connect</li>
                  <li>OR: Instagram app → Settings → Accounts Centre → Add Facebook account</li>
                  <li>Re-save your token above — the IG account ID will be detected automatically</li>
                </ol>
                <p className="text-xs font-medium text-amber-800 mt-1">Option B — Enter your IG Business Account ID manually:</p>
                <ol className="text-xs text-amber-700 pl-4 list-decimal space-y-0.5">
                  <li>Open <strong>Meta Graph API Explorer</strong> (developers.facebook.com/tools/explorer)</li>
                  <li>Paste your token and call: <code className="font-mono bg-amber-100 px-1 rounded">/me/accounts?fields=instagram_business_account&#123;id,username&#125;</code></li>
                  <li>Copy the <code className="font-mono bg-amber-100 px-1 rounded">id</code> value and paste it below</li>
                </ol>
              </div>
            )}

            <form onSubmit={handleSaveIgAccountId} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="ig-account-id" className="text-xs">
                  {hasIgBusinessAccountId ? "Update IG Business Account ID" : "IG Business Account ID"}
                </Label>
                <Input
                  id="ig-account-id"
                  value={igAccountId}
                  onChange={(e) => setIgAccountId(e.target.value)}
                  placeholder={currentIgBusinessAccountId ?? "e.g. 17841400000000000"}
                  className="font-mono text-xs h-8"
                />
              </div>
              <Button type="submit" size="sm" disabled={savingIgId || !igAccountId.trim()} className="h-8">
                {savingIgId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </form>

            {igIdSaved && (
              <p className="text-xs text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> IG Business Account ID saved — competitor sync should now work.
              </p>
            )}
            {igIdError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {igIdError}
              </p>
            )}
          </div>
        )}

        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">What this mode does NOT change</p>
          <ul className="pl-4 list-disc space-y-0.5">
            <li>Competitor metrics are still limited to API-supported public fields</li>
            <li>Reach, impressions, saves, and shares require own-account access</li>
            <li>Meta API rate limits still apply regardless of token source</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Connection row ───────────────────────────────────────────────────────────

function ConnectionRow({
  connection,
  onDisconnect,
}: {
  connection: Connection;
  onDisconnect: () => void;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const isActive = connection.status === "active";
  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;
  const tokenExpired = expiresAt ? expiresAt < new Date() : false;

  async function handleClick() {
    setDisconnecting(true);
    await onDisconnect();
    setDisconnecting(false);
  }

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center text-violet-700 font-semibold text-sm shrink-0">
            {connection.instagramUsername[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">@{connection.instagramUsername}</span>
              {isActive && !tokenExpired ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Active</Badge>
              ) : tokenExpired ? (
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Token Expired</Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 text-xs">Disconnected</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {expiresAt
                ? tokenExpired
                  ? `Expired ${expiresAt.toLocaleDateString()}`
                  : `Expires ${expiresAt.toLocaleDateString()}`
                : `Connected ${new Date(connection.createdAt).toLocaleDateString()}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={disconnecting || !isActive}
            className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
