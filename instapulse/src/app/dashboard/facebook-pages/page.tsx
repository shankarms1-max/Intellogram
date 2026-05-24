"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Globe,
  RefreshCw,
  ExternalLink,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

interface FacebookPageRow {
  id: string;
  facebookPageId: string;
  name: string;
  category: string | null;
  pictureUrl: string | null;
  link: string | null;
  fanCount: number | null;
  followersCount: number | null;
  linkedInstagramUsername: string | null;
  status: string;
  lastSyncedAt: string | null;
}

interface PagePost {
  id: string;
  facebookPostId: string;
  message: string | null;
  story: string | null;
  createdTime: string;
  permalinkUrl: string | null;
  reactionsCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  engagementCount: number | null;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-green-100 text-green-700 border-green-200"
      : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <Badge variant="outline" className={color}>
      {status}
    </Badge>
  );
}

function PagePostsDrawer({ pageId, pageName }: { pageId: string; pageName: string }) {
  const [posts, setPosts] = useState<PagePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/facebook-pages/${pageId}/posts?limit=10&sortBy=createdTime&sortOrder=desc`)
      .then((r) => r.json())
      .then((d) => {
        setPosts(d.posts ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [pageId]);

  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3">
        Recent posts for {pageName} — {total} total
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading posts…</p>
      ) : posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No posts imported yet. Click Sync to import posts.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Post</th>
              <th className="pb-2 pr-4 text-right font-medium">Reactions</th>
              <th className="pb-2 pr-4 text-right font-medium">Comments</th>
              <th className="pb-2 pr-4 text-right font-medium">Shares</th>
              <th className="pb-2 text-center font-medium w-6" />
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 whitespace-nowrap text-muted-foreground">
                  {new Date(post.createdTime).toLocaleDateString()}
                </td>
                <td className="py-1.5 pr-4 max-w-[260px]">
                  <span className="truncate block text-muted-foreground">
                    {post.message?.slice(0, 80) || post.story?.slice(0, 80) || (
                      <span className="italic">No text</span>
                    )}
                  </span>
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {post.reactionsCount != null ? formatNumber(post.reactionsCount) : "—"}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {post.commentsCount != null ? formatNumber(post.commentsCount) : "—"}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums">
                  {post.sharesCount != null ? formatNumber(post.sharesCount) : "—"}
                </td>
                <td className="py-1.5 text-center">
                  {post.permalinkUrl && (
                    <a
                      href={post.permalinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="View on Facebook"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function FacebookPagesPage() {
  const [pages, setPages] = useState<FacebookPageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deepImportId, setDeepImportId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/debug/meta-assets-check");
      if (!res.ok) throw new Error("Failed to load pages");
      const data = await res.json();
      setPages(data.facebookPages ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load Facebook Pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPages(); }, [loadPages]);

  async function handleDiscover() {
    setDiscovering(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/meta/discover-pages", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      setMessage(`Discovered ${data.pagesDiscovered} page(s).`);
      await loadPages();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleSync(pageId: string, mode: "initial_import" | "daily_refresh" | "deep") {
    if (mode === "deep") {
      setDeepImportId(pageId);
    } else {
      setSyncingId(pageId);
    }
    setError(null);
    setMessage(null);
    try {
      const url = mode === "deep"
        ? `/api/facebook-pages/${pageId}/deep-import`
        : `/api/facebook-pages/${pageId}/sync`;
      const body = mode !== "deep" ? JSON.stringify({ syncMode: mode }) : undefined;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Sync failed");
      setMessage(
        `Sync complete — ${data.upsertedPostCount ?? data.fetchedPostCount ?? 0} posts imported (${data.stoppedReason}).`
      );
      await loadPages();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncingId(null);
      setDeepImportId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-blue-600" />
            Facebook Pages
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Facebook Pages you manage, connected via Meta. Posts are imported using official Meta APIs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadPages} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={handleDiscover} disabled={discovering}>
            {discovering ? "Discovering…" : "Refresh Meta Assets"}
          </Button>
        </div>
      </div>

      {/* Limitation notice */}
      <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        Facebook Page intelligence supports Pages you manage through Meta permissions.
        Facebook competitor tracking is not included in this version.
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* Pages table */}
      {pages.length === 0 && !loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No Facebook Pages found</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Click &ldquo;Refresh Meta Assets&rdquo; to discover Pages connected to your Meta account.
          </p>
          <Button onClick={handleDiscover} disabled={discovering}>
            {discovering ? "Discovering…" : "Refresh Meta Assets"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Page</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[100px]">Followers</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Linked IG</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[90px]">Last Sync</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[70px]">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Actions</th>
                <th className="px-4 py-2.5 w-[30px]" />
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <>
                  <tr key={page.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {page.pictureUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={page.pictureUrl} alt={page.name} className="h-7 w-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Globe className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium">{page.name}</p>
                          {page.link && (
                            <a
                              href={page.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                            >
                              facebook.com <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {page.category ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                      {page.followersCount != null
                        ? formatNumber(page.followersCount)
                        : page.fanCount != null
                          ? formatNumber(page.fanCount)
                          : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {page.linkedInstagramUsername
                        ? <span className="font-medium">@{page.linkedInstagramUsername}</span>
                        : <span className="italic">Not linked</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {page.lastSyncedAt
                        ? new Date(page.lastSyncedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={page.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSync(page.id, page.lastSyncedAt ? "daily_refresh" : "initial_import")}
                          disabled={syncingId === page.id || deepImportId === page.id}
                        >
                          {syncingId === page.id ? "Syncing…" : "Sync"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSync(page.id, "deep")}
                          disabled={syncingId === page.id || deepImportId === page.id}
                          title="Import up to 500 posts"
                        >
                          {deepImportId === page.id ? "Importing…" : "Deep Import"}
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedId(expandedId === page.id ? null : page.id)}
                        title="Toggle posts"
                      >
                        {expandedId === page.id
                          ? <ChevronUp className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                  {expandedId === page.id && (
                    <tr key={`${page.id}-posts`} className="border-b border-border last:border-0">
                      <td colSpan={8} className="px-4 pb-3">
                        <PagePostsDrawer pageId={page.id} pageName={page.name} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Permissions note */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>
          <span className="font-medium">Permissions used:</span> pages_show_list, pages_read_engagement,
          instagram_basic, business_management (optional fallback).
        </p>
        <p>
          Facebook Page data is available for Pages you manage. Facebook competitor tracking is not
          included in this version.
        </p>
        <p>
          <Download className="inline h-3 w-3 mr-0.5" />
          Use &ldquo;Deep Import&rdquo; to fetch up to 500 posts per page. Standard sync fetches the latest 25.
        </p>
      </div>
    </div>
  );
}
