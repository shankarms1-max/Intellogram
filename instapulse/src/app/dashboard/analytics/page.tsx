"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BarChart3, Users, Heart, MessageCircle, TrendingUp, RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { MetricCardSkeleton, ChartSkeleton } from "@/components/dashboard/LoadingSkeleton";
import { AccountTypeBadge } from "@/components/dashboard/AccountTypeBadge";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const CHART_COLORS = [
  "#7c3aed", "#db2777", "#2563eb", "#16a34a", "#ea580c", "#0891b2", "#9333ea", "#65a30d",
];

interface SummaryData {
  totalAccounts: number;
  ownAccountsCount: number;
  competitorAccountsCount: number;
  totalFollowers: number;
  totalMediaFetched: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  avgEngagementRate: number;
  topPost: {
    id: string;
    caption: string | null;
    permalink: string | null;
    engagementRate: number | null;
    account: string | null;
    mediaType: string;
  } | null;
  topAccount: {
    id: string;
    username: string;
    accountType: string;
    engagement: number;
  } | null;
}

interface TopAccount {
  id: string;
  username: string;
  displayName: string | null;
  accountType: string;
  followers: number | null;
  engagement: number;
  postCount: number;
  engagementRate: number | null;
}

interface MarketShareItem {
  username: string;
  accountType: string;
  engagement: number;
  posts: number;
  engagementShare: number;
  postShare: number;
}

interface EngagementTrendItem {
  date: string;
  likes: number;
  comments: number;
  posts: number;
  engagement: number;
}

type FollowerTrendItem = { date: string; [username: string]: string | number };

interface SummaryResponse {
  summary: SummaryData;
  topAccounts: TopAccount[];
  marketShare: MarketShareItem[];
}

interface TrendsResponse {
  followerTrends: FollowerTrendItem[];
  engagementTrends: EngagementTrendItem[];
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, trendsRes] = await Promise.all([
        fetch(`/api/analytics/summary?days=${days}`),
        fetch(`/api/analytics/trends?days=${days}`),
      ]);

      if (!summaryRes.ok || !trendsRes.ok) throw new Error("Failed to load analytics");

      const [summary, trends] = await Promise.all([
        summaryRes.json() as Promise<SummaryResponse>,
        trendsRes.json() as Promise<TrendsResponse>,
      ]);

      setSummaryData(summary);
      setTrendsData(trends);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const followerKeys = trendsData?.followerTrends?.length
    ? Object.keys(trendsData.followerTrends[0]).filter((k) => k !== "date")
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Performance metrics and trends across all tracked accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === opt.value
                    ? "bg-violet-600 text-white"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : summaryData ? (
          <>
            <MetricCard
              title="Total Accounts"
              value={summaryData.summary.totalAccounts}
              icon={<Users className="h-4 w-4" />}
              description={`${summaryData.summary.ownAccountsCount} own · ${summaryData.summary.competitorAccountsCount} competitor`}
            />
            <MetricCard
              title="Total Followers"
              value={summaryData.summary.totalFollowers}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              title="Media Fetched"
              value={summaryData.summary.totalMediaFetched}
              icon={<BarChart3 className="h-4 w-4" />}
              description={`Last ${days} days`}
            />
            <MetricCard
              title="Avg Engagement Rate"
              value={summaryData.summary.avgEngagementRate}
              format="percent"
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <MetricCard
              title="Total Likes"
              value={summaryData.summary.totalLikes}
              icon={<Heart className="h-4 w-4" />}
              description={`Last ${days} days`}
            />
            <MetricCard
              title="Total Comments"
              value={summaryData.summary.totalComments}
              icon={<MessageCircle className="h-4 w-4" />}
              description={`Last ${days} days`}
            />
            <MetricCard
              title="Own Accounts"
              value={summaryData.summary.ownAccountsCount}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              title="Competitors"
              value={summaryData.summary.competitorAccountsCount}
              icon={<Users className="h-4 w-4" />}
            />
          </>
        ) : null}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Engagement Trends */}
        <ChartCard
          title="Engagement Trends"
          description={`Likes, comments and posts over the last ${days} days`}
        >
          {loading ? (
            <ChartSkeleton height={260} />
          ) : !trendsData?.engagementTrends?.length ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
              No engagement data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendsData.engagementTrends} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={40} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderColor: "var(--border)", background: "var(--card)" }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="likes" stroke="#7c3aed" strokeWidth={2} dot={false} name="Likes" />
                <Line type="monotone" dataKey="comments" stroke="#db2777" strokeWidth={2} dot={false} name="Comments" />
                <Line type="monotone" dataKey="posts" stroke="#2563eb" strokeWidth={2} dot={false} name="Posts" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Follower Growth */}
        <ChartCard
          title="Follower Growth"
          description={`Followers tracked over the last ${days} days`}
        >
          {loading ? (
            <ChartSkeleton height={260} />
          ) : !trendsData?.followerTrends?.length || followerKeys.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
              No follower snapshot data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendsData.followerTrends} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={50} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderColor: "var(--border)", background: "var(--card)" }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                  formatter={(v) => [formatNumber(Number(v ?? 0)), ""]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {followerKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={`@${key}`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top Accounts by Engagement */}
        <ChartCard
          title="Top Accounts by Engagement"
          description="Total likes + comments per account"
        >
          {loading ? (
            <ChartSkeleton height={260} />
          ) : !summaryData?.topAccounts?.length ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
              No accounts with engagement data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={summaryData.topAccounts.slice(0, 8)}
                margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="username"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  angle={-35}
                  textAnchor="end"
                  tickFormatter={(v) => `@${v}`}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={40} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderColor: "var(--border)", background: "var(--card)" }}
                  formatter={(v) => [formatNumber(Number(v ?? 0)), "Engagement"]}
                  labelFormatter={(v) => `@${v}`}
                />
                <Bar dataKey="engagement" fill="#7c3aed" radius={[3, 3, 0, 0]} name="Engagement" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Market Share (Engagement Share) */}
        <ChartCard
          title="Engagement Share"
          description="Share of total engagement by account"
        >
          {loading ? (
            <ChartSkeleton height={260} />
          ) : !summaryData?.marketShare?.filter((m) => m.engagement > 0).length ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
              No engagement data for market share
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={summaryData.marketShare
                    .filter((m) => m.engagement > 0)
                    .slice(0, 8)}
                  dataKey="engagementShare"
                  nameKey="username"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, value }) =>
                    `@${name} ${Number(value).toFixed(1)}%`
                  }
                  labelLine={false}
                >
                  {summaryData.marketShare
                    .filter((m) => m.engagement > 0)
                    .slice(0, 8)
                    .map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderColor: "var(--border)", background: "var(--card)" }}
                  formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, "Share"]}
                  labelFormatter={(v) => `@${v}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(v) => `@${v}`}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Top Accounts Table */}
      {!loading && summaryData?.topAccounts && summaryData.topAccounts.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Top Accounts by Engagement</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Account</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Followers</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Engagement</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Posts</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Eng. Rate</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.topAccounts.map((acct, i) => (
                  <tr key={acct.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        >
                          {acct.username[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium">@{acct.username}</span>
                        {acct.displayName && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {acct.displayName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <AccountTypeBadge type={acct.accountType as "own" | "competitor" | "influencer" | "brand" | "other"} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {acct.followers != null ? formatNumber(acct.followers) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatNumber(acct.engagement)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {acct.postCount}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {acct.engagementRate != null ? formatPercent(acct.engagementRate) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
