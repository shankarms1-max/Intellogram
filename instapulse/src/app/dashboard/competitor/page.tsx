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

export default function CompetitorPage() {
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const nonOwnAccounts = accounts.filter((a) => a.accountType !== "own");
  const competitors = nonOwnAccounts.filter((a) => a.accountType === "competitor");
  const influencers = nonOwnAccounts.filter((a) => a.accountType === "influencer");
  const brands = nonOwnAccounts.filter((a) => a.accountType === "brand");
  const others = nonOwnAccounts.filter((a) => a.accountType === "other");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Competitor Monitoring</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Public-data monitoring for competitors, influencers, and brands via the official Instagram API.
        </p>
      </div>

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
                      <AccountCard key={account.id} account={account} />
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
    </div>
  );
}

function AccountCard({ account }: { account: TrackedAccount }) {
  const lastSync = account.lastSyncedAt ? new Date(account.lastSyncedAt) : null;

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

      {account.notes && (
        <p className="text-xs text-muted-foreground italic truncate" title={account.notes}>
          Note: {account.notes}
        </p>
      )}

      {lastSync && (
        <p className="text-xs text-muted-foreground">
          Last synced {lastSync.toLocaleDateString()}
        </p>
      )}
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
