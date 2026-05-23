"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  TrendingUp,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  BarChart3,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Lock,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatNumber, formatPercent } from "@/lib/utils";
import { AccountTypeBadge } from "@/components/dashboard/AccountTypeBadge";

type AccountType = "own" | "competitor" | "influencer" | "brand" | "other";

interface TrackedAccount {
  id: string;
  username: string;
  displayName: string | null;
  biography: string | null;
  website: string | null;
  accountType: AccountType;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  status: string;
  lastSyncedAt: string | null;
  notes: string | null;
  _count?: { mediaItems: number };
  recentEngagement?: number | null;
  avgEngagementRate?: number | null;
}

interface SyncResult {
  success: boolean;
  status?: string;
  message?: string;
  details?: string;
  ownSyncAvailable?: boolean;
  recommendedActions?: string[];
  error?: string;
  mediaCount?: number;
}

interface MetricRow {
  label: string;
  ownAvailable: boolean;
  competitorAvailable: boolean | "limited";
  note?: string;
}

const METRIC_MATRIX: MetricRow[] = [
  {
    label: "Follower count",
    ownAvailable: true,
    competitorAvailable: "limited",
    note: "Available for public accounts only",
  },
  {
    label: "Following count",
    ownAvailable: true,
    competitorAvailable: false,
    note: "Not accessible via API for third-party accounts",
  },
  {
    label: "Post count",
    ownAvailable: true,
    competitorAvailable: "limited",
    note: "Available for public accounts only",
  },
  {
    label: "Public media (likes, comments)",
    ownAvailable: true,
    competitorAvailable: "limited",
    note: "Only for public posts; requires media endpoint access",
  },
  {
    label: "Reach & impressions",
    ownAvailable: true,
    competitorAvailable: false,
    note: "Requires instagram_manage_insights — own accounts only",
  },
  {
    label: "Saves",
    ownAvailable: true,
    competitorAvailable: false,
    note: "Own accounts only via Media Insights API",
  },
  {
    label: "Shares",
    ownAvailable: true,
    competitorAvailable: false,
    note: "Own accounts only via Media Insights API",
  },
  {
    label: "Story insights",
    ownAvailable: true,
    competitorAvailable: false,
    note: "Stories are private; no third-party access",
  },
  {
    label: "Audience demographics",
    ownAvailable: true,
    competitorAvailable: false,
    note: "Only available for your own connected accounts",
  },
  {
    label: "Follower growth history",
    ownAvailable: true,
    competitorAvailable: false,
    note: "Only tracked from the day you add the account",
  },
  {
    label: "Engagement rate (calculated)",
    ownAvailable: true,
    competitorAvailable: "limited",
    note: "Calculated from available public likes + comments / followers",
  },
];

const APP_MODE_MATRIX = [
  {
    label: "Own account profile & media",
    devMode: "Works for connected tester/admin accounts",
    liveApproved: "Works for all connected accounts",
  },
  {
    label: "Own account insights (reach, saves)",
    devMode: "Works for connected tester/admin accounts",
    liveApproved: "Works for all connected accounts",
  },
  {
    label: "Competitor public profile & media",
    devMode: "App tester/role accounts only",
    liveApproved: "Works where Business Discovery supports the target",
  },
  {
    label: "Competitor reach / saves / shares",
    devMode: "Not available (private metrics)",
    liveApproved: "Not available (private metrics)",
  },
];

function AvailabilityBadge({ value }: { value: boolean | "limited" }) {
  if (value === true) {
    return (
      <span className="flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="text-xs">Available</span>
      </span>
    );
  }
  if (value === "limited") {
    return (
      <span className="flex items-center gap-1 text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs">Limited</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <XCircle className="h-3.5 w-3.5" />
      <span className="text-xs">Not available</span>
    </span>
  );
}

function Checklist({ title, items, note }: { title: string; items: string[]; note?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2">{title}</p>
      <ul className="space-y-1.5 mb-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
      {note && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">{note}</p>}
    </div>
  );
}

export default function CompetitorPage() {
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({});
  const [checklistOpen, setChecklistOpen] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts?types=competitor,influencer,brand,other");
      if (!res.ok) throw new Error("Failed to load accounts");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSync = useCallback(async (accountId: string) => {
    setSyncingId(accountId);
    setSyncResults((prev) => ({ ...prev, [accountId]: { success: false } }));
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync`, { method: "POST" });
      const data: SyncResult = await res.json();
      setSyncResults((prev) => ({ ...prev, [accountId]: data }));
      if (data.success) {
        // Refresh account list to show updated data
        fetchAccounts();
      }
    } catch {
      setSyncResults((prev) => ({
        ...prev,
        [accountId]: { success: false, error: "Network error. Please try again." },
      }));
    } finally {
      setSyncingId(null);
    }
  }, [fetchAccounts]);

  const nonOwnAccounts = accounts.filter((a) => a.accountType !== "own");
  const competitors = nonOwnAccounts.filter((a) => a.accountType === "competitor");
  const influencers = nonOwnAccounts.filter((a) => a.accountType === "influencer");
  const brands = nonOwnAccounts.filter((a) => a.accountType === "brand");
  const others = nonOwnAccounts.filter((a) => a.accountType === "other");

  const hasLiveModeBanner = Object.values(syncResults).some(
    (r) => r.status === "requires_live_mode_or_tester"
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Competitor Monitoring</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Public-data monitoring for competitors, influencers, and brands via the official Instagram API.
        </p>
      </div>

      {/* Requires Live Mode banner — shown after a sync attempt hits Dev mode gating */}
      {hasLiveModeBanner && (
        <div className="flex items-start gap-3 rounded-lg bg-violet-50 border border-violet-200 px-4 py-4">
          <Lock className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-violet-900">Competitor sync requires Meta Live access</p>
            <p className="text-violet-800 leading-relaxed">
              Your Instagram connection is working, but this Meta app is currently in{" "}
              <strong>Development mode</strong>. In Development mode, Meta restricts Business
              Discovery to Instagram accounts associated with app roles/testers.
            </p>
            <p className="text-violet-700">
              To sync public competitors, complete Meta App Review, switch the app to Live mode,
              and ensure the required permissions are approved.
            </p>
            <p className="text-emerald-700 font-medium mt-2">
              Own Instagram analytics can continue syncing normally.
            </p>
          </div>
        </div>
      )}

      {/* API Limitation Banner */}
      <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-4">
        <Info className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-amber-800">Instagram API Limitations for Third-Party Accounts</p>
          <p className="text-amber-700 mt-1 leading-relaxed">
            Meta&apos;s Graph API restricts access to private insights for accounts you do not own.
            Metrics like reach, impressions, saves, and story data are{" "}
            <strong>only available for your own connected Business/Creator accounts</strong>.
            Competitor monitoring is limited to publicly accessible data only.
          </p>
        </div>
      </div>

      {/* Development Mode Note */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-4">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-blue-800">Development mode note</p>
          <p className="text-blue-700 mt-1 leading-relaxed">
            Business Discovery can be tested in Development mode <strong>only with Instagram accounts
            connected to app testers/roles</strong>. Public competitors require Live mode and approved
            Meta permissions.
          </p>
          <p className="text-blue-700 mt-1">
            This does not mean the connection is broken. Your own account analytics can still work normally.
          </p>
        </div>
      </div>

      {/* Metric Availability Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Metric Availability Matrix
          </CardTitle>
          <CardDescription>
            What data the Instagram Graph API provides per account type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground w-1/2">Metric</th>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground w-1/4">Own accounts</th>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground w-1/4">Competitors / others</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_MATRIX.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-xs">{row.label}</p>
                      {row.note && (
                        <p className="text-xs text-muted-foreground mt-0.5">{row.note}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <AvailabilityBadge value={row.ownAvailable} />
                    </td>
                    <td className="py-2.5">
                      <AvailabilityBadge value={row.competitorAvailable} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Limited (public only)
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" /> Not available via API
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Business Discovery: App Mode Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Business Discovery: Development vs Live Mode
          </CardTitle>
          <CardDescription>
            Instagram competitor sync where supported by Meta Business Discovery.
            Public competitor sync requires Meta Live access and approved permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground w-1/2">Capability</th>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground w-1/4">Development mode</th>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground w-1/4">Live mode + approved</th>
                </tr>
              </thead>
              <tbody>
                {APP_MODE_MATRIX.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 text-xs font-medium">{row.label}</td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{row.devMode}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{row.liveApproved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Account list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Tracked External Accounts
            {!loading && <span className="text-sm font-normal text-muted-foreground ml-2">({nonOwnAccounts.length})</span>}
          </h2>
          <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading accounts…
          </div>
        ) : nonOwnAccounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">No competitor accounts tracked</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Add accounts via the{" "}
                <a href="/dashboard/accounts" className="underline">Accounts</a>{" "}
                page and set their type to competitor, influencer, or brand.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {[
              { label: "Competitors", items: competitors },
              { label: "Influencers", items: influencers },
              { label: "Brands", items: brands },
              { label: "Other", items: others },
            ]
              .filter((g) => g.items.length > 0)
              .map((group) => (
                <div key={group.label}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">{group.label}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.items.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        isSyncing={syncingId === account.id}
                        syncResult={syncResults[account.id] ?? null}
                        onSync={() => handleSync(account.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* What we track section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            What We Monitor for Competitor Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Users, label: "Follower count", available: true, note: "Updated each sync for public accounts" },
              { icon: ImageIcon, label: "Public post count", available: true, note: "Total media count from profile" },
              { icon: Heart, label: "Public likes", available: true, note: "Likes on publicly visible posts" },
              { icon: MessageCircle, label: "Public comments", available: true, note: "Comment counts on public posts" },
              { icon: TrendingUp, label: "Engagement rate (est.)", available: true, note: "Calculated from public likes + comments" },
              { icon: BarChart3, label: "Follower growth", available: true, note: "Tracked from when you add the account" },
            ].map(({ icon: Icon, label, available, note }) => (
              <div key={label} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className={`p-1.5 rounded-md shrink-0 ${available ? "bg-emerald-50" : "bg-muted"}`}>
                  <Icon className={`h-3.5 w-3.5 ${available ? "text-emerald-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            <strong>Not available for competitor accounts:</strong> reach, impressions, saves, shares,
            story views, audience demographics, reel plays, and any metric requiring{" "}
            <code className="font-mono bg-muted px-1 rounded">instagram_manage_insights</code> permission.
            These are shown as &quot;—&quot; rather than zero.
          </div>
        </CardContent>
      </Card>

      {/* Checklists section */}
      <Card>
        <CardHeader className="pb-2">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setChecklistOpen((v) => !v)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" />
              How to Enable Competitor Sync
            </CardTitle>
            {checklistOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <CardDescription>
            Testing in Development mode and enabling public competitor sync in Live mode.
          </CardDescription>
        </CardHeader>
        {checklistOpen && (
          <CardContent className="space-y-6 pt-0">
            <Checklist
              title="How to test competitor sync in Development mode"
              items={[
                "Create or use another Instagram Business/Creator account.",
                "Link that Instagram account to a Facebook Page.",
                "Add the Facebook user who owns that account as an app tester, developer, or admin in Meta App Dashboard → Roles.",
                "Ask the user to accept the app tester invitation at developers.facebook.com.",
                "Use that Instagram username as the competitor handle in this app.",
                "Run competitor sync again.",
              ]}
              note="Public accounts like @natgeo will not work in Development mode unless they are connected to an app role/tester account."
            />
            <Separator />
            <Checklist
              title="How to enable public competitor sync (Meta App Review)"
              items={[
                "Complete Meta Business Verification if Meta requests it.",
                "Add Privacy Policy URL to App Settings.",
                "Add Terms of Service URL to App Settings.",
                "Add Data Deletion callback URL to App Settings.",
                "Ensure the production OAuth redirect URI is configured exactly in Facebook Login settings.",
                "Submit App Review for: instagram_basic, instagram_manage_insights, pages_read_engagement, pages_show_list, business_management.",
                'Include a demo video showing: user login, Instagram OAuth connection, own account analytics, Business Discovery competitor comparison, and data deletion page.',
                "Switch the app to Live mode after approval.",
                "Test with a real public Instagram Business/Creator competitor account.",
              ]}
              note="Meta controls App Review timelines and approval decisions. Approval cannot be guaranteed by the app."
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function AccountCard({
  account,
  isSyncing,
  syncResult,
  onSync,
}: {
  account: TrackedAccount;
  isSyncing: boolean;
  syncResult: SyncResult | null;
  onSync: () => void;
}) {
  const lastSync = account.lastSyncedAt ? new Date(account.lastSyncedAt) : null;
  const isGated = syncResult?.status === "requires_live_mode_or_tester";
  const isFailed = syncResult && !syncResult.success && !isGated;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center text-violet-700 font-semibold text-sm shrink-0">
          {account.username[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">@{account.username}</span>
            <AccountTypeBadge type={account.accountType} />
          </div>
          {account.displayName && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{account.displayName}</p>
          )}
        </div>
        <a
          href={`https://www.instagram.com/${account.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="View on Instagram"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Metrics grid — public data only */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCell
          icon={<Users className="h-3 w-3" />}
          label="Followers"
          value={account.followersCount != null ? formatNumber(account.followersCount) : null}
        />
        <MetricCell
          icon={<ImageIcon className="h-3 w-3" />}
          label="Posts"
          value={account.mediaCount != null ? formatNumber(account.mediaCount) : null}
        />
        <MetricCell
          icon={<BarChart3 className="h-3 w-3" />}
          label="Eng. rate"
          value={account.avgEngagementRate != null ? formatPercent(account.avgEngagementRate, 1) : null}
          unavailableLabel="Est. only"
        />
      </div>

      {/* What's not available */}
      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">Not available via API:</span> reach, impressions, saves,
        shares, story insights
      </div>

      {/* Sync status feedback */}
      {isGated && (
        <div className="flex items-start gap-2 rounded-md bg-violet-50 border border-violet-200 px-3 py-2 text-xs text-violet-800">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-violet-600" />
          <div>
            <p className="font-medium">Requires Meta Live access</p>
            <p className="text-violet-700 mt-0.5">
              Business Discovery is restricted in Development mode. Test with an app tester account,
              or switch to Live mode after App Review.
            </p>
          </div>
        </div>
      )}
      {isFailed && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {syncResult?.error ?? "Sync failed. Check account type and username."}
        </div>
      )}
      {syncResult?.success && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Synced {syncResult.mediaCount != null ? `${syncResult.mediaCount} posts` : "successfully"}.
        </div>
      )}

      {account.notes && (
        <p className="text-xs text-muted-foreground italic truncate" title={account.notes}>
          Note: {account.notes}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        {lastSync ? (
          <p className="text-xs text-muted-foreground">
            Last synced {lastSync.toLocaleDateString()}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Never synced</p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {isSyncing ? "Syncing…" : "Sync"}
        </Button>
      </div>
    </div>
  );
}

function MetricCell({
  icon,
  label,
  value,
  unavailableLabel = "—",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  unavailableLabel?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${value == null ? "text-muted-foreground" : ""}`}>
        {value ?? unavailableLabel}
      </p>
    </div>
  );
}
