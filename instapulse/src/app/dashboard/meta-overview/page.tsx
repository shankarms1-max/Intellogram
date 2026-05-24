"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  Globe,
  Link2,
  RefreshCw,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

interface MetaAssets {
  instagramAccountsCount: number;
  facebookPagesCount: number;
  linkedPairsCount: number;
  linkedAssets: Array<{
    facebookPageId: string;
    pageName: string;
    instagramBusinessAccountId: string | null;
    instagramUsername: string | null;
  }>;
  instagramAccounts: Array<{
    id: string;
    username: string;
    followersCount: number | null;
    status: string;
    lastSyncedAt: string | null;
  }>;
  facebookPages: Array<{
    id: string;
    name: string;
    fanCount: number | null;
    followersCount: number | null;
    status: string;
    lastSyncedAt: string | null;
  }>;
}

interface TopItem {
  platform: "instagram" | "facebook";
  accountOrPage: string;
  content: string;
  type: string;
  publishedDate: string;
  likes: number | null;
  comments: number | null;
  views: number | null;
  reactions: number | null;
  shares: number | null;
  permalink: string | null;
}

interface TopContentData {
  items: TopItem[];
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

export default function MetaOverviewPage() {
  const [assets, setAssets] = useState<MetaAssets | null>(null);
  const [topContent, setTopContent] = useState<TopContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [assetsRes, mediaRes] = await Promise.all([
        fetch("/api/debug/meta-assets-check"),
        fetch("/api/media?limit=10&sortBy=likeCount&sortOrder=desc"),
      ]);

      if (assetsRes.ok) setAssets(await assetsRes.json());

      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        const items: TopItem[] = (mediaData.items ?? []).map(
          (item: {
            trackedAccount: { username: string };
            mediaType: string;
            mediaProductType: string | null;
            caption: string | null;
            timestamp: string;
            likeCount: number | null;
            commentsCount: number | null;
            viewsCount: number | null;
            permalink: string | null;
          }) => ({
            platform: "instagram" as const,
            accountOrPage: `@${item.trackedAccount.username}`,
            content: item.caption?.slice(0, 80) ?? "No caption",
            type: item.mediaProductType === "REELS" ? "Reel" : item.mediaType === "IMAGE" ? "Image" : item.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Video",
            publishedDate: item.timestamp,
            likes: item.likeCount,
            comments: item.commentsCount,
            views: item.viewsCount,
            reactions: null,
            shares: null,
            permalink: item.permalink,
          })
        );
        setTopContent({ items });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Meta Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track Instagram and Facebook Page performance from one connected Meta workspace.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Connected Assets */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Connected Assets
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            label="Instagram Accounts"
            value={assets?.instagramAccountsCount ?? "—"}
            icon={<Camera className="h-4 w-4" />}
          />
          <StatCard
            label="Facebook Pages"
            value={assets?.facebookPagesCount ?? "—"}
            icon={<Globe className="h-4 w-4" />}
          />
          <StatCard
            label="Linked IG ↔ FB Pairs"
            value={assets?.linkedPairsCount ?? "—"}
            icon={<Link2 className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Linked pairs */}
      {assets && assets.linkedPairsCount > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Linked Instagram ↔ Facebook Page Pairs
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Facebook Page</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Linked Instagram</th>
                </tr>
              </thead>
              <tbody>
                {assets.linkedAssets.map((pair) => (
                  <tr key={pair.facebookPageId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="text-xs font-medium">{pair.pageName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {pair.instagramUsername ? (
                        <div className="flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                          <span className="text-xs">@{pair.instagramUsername}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not linked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Instagram Content */}
      {topContent && topContent.items.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Top Instagram Content
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[130px]">Account</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Content</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[80px]">Type</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[90px]">Published</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[70px]">
                      <span className="flex items-center gap-1 justify-end">
                        <Heart className="h-3 w-3" /> Likes
                      </span>
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[80px]">
                      <span className="flex items-center gap-1 justify-end">
                        <MessageCircle className="h-3 w-3" /> Comments
                      </span>
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[80px]">
                      <span className="flex items-center gap-1 justify-end">
                        <Eye className="h-3 w-3" /> IG Views
                      </span>
                    </th>
                    <th className="px-4 py-2.5 w-[30px]" />
                  </tr>
                </thead>
                <tbody>
                  {topContent.items.map((item, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                          <span className="text-xs font-medium truncate">{item.accountOrPage}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 max-w-[240px]">
                        <p className="text-xs text-muted-foreground truncate">{item.content}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs">
                          {item.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.publishedDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {item.likes != null ? formatNumber(item.likes) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {item.comments != null ? formatNumber(item.comments) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {item.views != null
                          ? <span title="Instagram Views from Meta view_count">{formatNumber(item.views)}</span>
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {item.permalink && (
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title="View on Instagram"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <Share2 className="inline h-3 w-3 mr-0.5" />
            Facebook shares and reactions are shown in the Facebook Pages section.
            Instagram Views are only returned by Meta for some VIDEO/REELS.
          </p>
        </div>
      )}

      {/* No data state */}
      {!loading && (!assets || (assets.instagramAccountsCount === 0 && assets.facebookPagesCount === 0)) && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No Meta assets connected</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Connect your Meta account to see Instagram accounts and Facebook Pages here.
          </p>
          <Button asChild>
            <a href="/dashboard/connect">Connect Meta Account</a>
          </Button>
        </div>
      )}
    </div>
  );
}
