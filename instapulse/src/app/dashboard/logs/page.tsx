"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/dashboard/LoadingSkeleton";
import { EmptyState } from "@/components/dashboard/EmptyState";

interface ApiLog {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

type FilterValue = "all" | "success" | "error";

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "error", label: "Errors" },
];

function endpointLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url.length > 60 ? url.slice(0, 60) + "…" : url;
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filter !== "all") params.set("filter", filter);
      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) throw new Error("Failed to load logs");
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load logs");
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleFilterChange(v: FilterValue) {
    setFilter(v);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">API Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Outbound Meta Graph API calls made by this workspace.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total calls</p>
          <p className="text-2xl font-bold mt-1">{total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs text-emerald-700">Successful</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {logs.filter((l) => l.success).length}
            {filter !== "all" && <span className="text-sm font-normal"> (page)</span>}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs text-red-700">Errors</p>
          <p className="text-2xl font-bold text-red-700 mt-1">
            {logs.filter((l) => !l.success).length}
            {filter !== "all" && <span className="text-sm font-normal"> (page)</span>}
          </p>
        </div>
      </div>

      {/* Filter + error */}
      <div className="flex items-center gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={filter === opt.value ? "default" : "outline"}
            onClick={() => handleFilterChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={10} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-12 w-12" />}
          title="No API logs yet"
          description="Logs appear here when accounts are synced via the Instagram API."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-8"></th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Endpoint</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Method</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Duration</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="font-mono text-xs truncate block" title={log.endpoint}>
                        {endpointLabel(log.endpoint)}
                      </span>
                      {log.errorMessage && (
                        <span className="text-xs text-red-600 mt-0.5 block truncate" title={log.errorMessage}>
                          {log.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.method}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {log.statusCode != null ? (
                        <Badge
                          variant="outline"
                          className={
                            log.success
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                              : "bg-red-50 text-red-700 border-red-200 text-xs"
                          }
                        >
                          {log.statusCode}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.durationMs != null ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {log.durationMs}ms
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
