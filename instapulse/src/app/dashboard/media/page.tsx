"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Filter,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AccountTypeBadge } from "@/components/dashboard/AccountTypeBadge";
import { TableSkeleton } from "@/components/dashboard/LoadingSkeleton";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { formatNumber, formatPercent } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  REEL: "Reel",
  CAROUSEL_ALBUM: "Carousel",
};

const MEDIA_TYPE_COLORS: Record<string, string> = {
  IMAGE: "bg-blue-100 text-blue-700 border-blue-200",
  VIDEO: "bg-orange-100 text-orange-700 border-orange-200",
  REEL: "bg-pink-100 text-pink-700 border-pink-200",
  CAROUSEL_ALBUM: "bg-purple-100 text-purple-700 border-purple-200",
};

type SortField = "timestamp" | "likeCount" | "commentsCount" | "viewsCount" | "engagementRate";
type SortOrder = "asc" | "desc";

function SortIcon({ field, sortBy, sortOrder }: { field: SortField; sortBy: SortField; sortOrder: SortOrder }) {
  if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
  return sortOrder === "desc"
    ? <ChevronDown className="h-3 w-3 text-violet-600" />
    : <ChevronUp className="h-3 w-3 text-violet-600" />;
}

interface TrackedAccountInfo {
  username: string;
  accountType: string;
  profilePictureUrl: string | null;
}

interface MediaItem {
  id: string;
  trackedAccountId: string;
  trackedAccount: TrackedAccountInfo;
  mediaType: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
  viewsCount: number | null;
  engagementRate: number | null;
  hashtags: string[];
}

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [mediaType, setMediaType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, mediaType, dateFrom, dateTo, sortBy, sortOrder]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (mediaType && mediaType !== "all") params.set("mediaType", mediaType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/media?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load media");
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load media items");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, mediaType, dateFrom, dateTo, sortBy, sortOrder]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  }

  const exportUrl = `/api/export/media.csv${mediaType && mediaType !== "all" ? `?mediaType=${mediaType}` : ""}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Media Explorer</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse and filter all tracked posts, reels, and videos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={exportUrl} download>
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search captions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Media type */}
        <Select value={mediaType} onValueChange={setMediaType}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="IMAGE">Image</SelectItem>
            <SelectItem value="VIDEO">Video</SelectItem>
            <SelectItem value="REEL">Reel</SelectItem>
            <SelectItem value="CAROUSEL_ALBUM">Carousel</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[140px] text-sm"
            placeholder="From"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[140px] text-sm"
            placeholder="To"
          />
        </div>

        {(search || (mediaType && mediaType !== "all") || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setMediaType("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Total count */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          {total === 0 ? "No items found" : `Showing ${items.length} of ${formatNumber(total)} items`}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-12 w-12" />}
          title="No media found"
          description="Try adjusting your filters or sync accounts to fetch media."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[160px]">
                    Account
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Caption
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-[100px]">
                    Type
                  </th>
                  <th
                    className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[110px] cursor-pointer select-none"
                    onClick={() => handleSort("timestamp")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Posted <SortIcon field="timestamp" sortBy={sortBy} sortOrder={sortOrder} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[80px] cursor-pointer select-none"
                    onClick={() => handleSort("likeCount")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Likes <SortIcon field="likeCount" sortBy={sortBy} sortOrder={sortOrder} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[90px] cursor-pointer select-none"
                    onClick={() => handleSort("commentsCount")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Comments <SortIcon field="commentsCount" sortBy={sortBy} sortOrder={sortOrder} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[80px] cursor-pointer select-none"
                    onClick={() => handleSort("viewsCount")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Views <SortIcon field="viewsCount" sortBy={sortBy} sortOrder={sortOrder} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-[90px] cursor-pointer select-none"
                    onClick={() => handleSort("engagementRate")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Eng. Rate <SortIcon field="engagementRate" sortBy={sortBy} sortOrder={sortOrder} />
                    </span>
                  </th>
                  <th className="px-4 py-2.5 w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold shrink-0">
                          {item.trackedAccount.username[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">@{item.trackedAccount.username}</p>
                          <AccountTypeBadge type={item.trackedAccount.accountType as "own" | "competitor" | "influencer" | "brand" | "other"} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[280px]">
                      <p className="text-xs text-muted-foreground truncate">
                        {item.caption?.slice(0, 100) || <span className="italic">No caption</span>}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={MEDIA_TYPE_COLORS[item.mediaType] || "bg-gray-100 text-gray-700"}
                      >
                        {MEDIA_TYPE_LABELS[item.mediaType] || item.mediaType}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                      {item.likeCount != null ? formatNumber(item.likeCount) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                      {item.commentsCount != null ? formatNumber(item.commentsCount) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                      {item.viewsCount != null ? formatNumber(item.viewsCount) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium">
                      {item.engagementRate != null ? formatPercent(item.engagementRate) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {item.permalink ? (
                        <a
                          href={item.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="View on Instagram"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Page {page} of {pages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
