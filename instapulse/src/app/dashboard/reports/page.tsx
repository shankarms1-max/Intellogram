"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Download,
  Plus,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  BarChart3,
  Users,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/dashboard/LoadingSkeleton";
import { EmptyState } from "@/components/dashboard/EmptyState";

type ReportType =
  | "daily_snapshot"
  | "weekly_competitor"
  | "monthly_performance"
  | "own_vs_competitor"
  | "top_content";

interface ReportConfig {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultName: string;
}

const REPORT_CONFIGS: ReportConfig[] = [
  {
    type: "daily_snapshot",
    title: "Daily Snapshot",
    description: "Summary of all tracked accounts today — followers, engagement, and top posts.",
    icon: <Calendar className="h-5 w-5 text-violet-600" />,
    defaultName: "Daily Snapshot",
  },
  {
    type: "weekly_competitor",
    title: "Weekly Competitor Report",
    description: "Compare your accounts vs competitors over the last week.",
    icon: <Users className="h-5 w-5 text-red-500" />,
    defaultName: "Weekly Competitor Report",
  },
  {
    type: "monthly_performance",
    title: "Monthly Performance",
    description: "Full month analysis of growth, engagement, and content performance.",
    icon: <TrendingUp className="h-5 w-5 text-blue-500" />,
    defaultName: "Monthly Performance",
  },
  {
    type: "own_vs_competitor",
    title: "Own vs Competitor",
    description: "Side-by-side comparison of your accounts against tracked competitors.",
    icon: <BarChart3 className="h-5 w-5 text-emerald-600" />,
    defaultName: "Own vs Competitor Analysis",
  },
  {
    type: "top_content",
    title: "Top Content",
    description: "Best performing posts and reels ranked by engagement rate.",
    icon: <Trophy className="h-5 w-5 text-amber-500" />,
    defaultName: "Top Content Report",
  },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  failed: {
    label: "Failed",
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "bg-red-100 text-red-700 border-red-200",
  },
  generating: {
    label: "Generating",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

interface Report {
  id: string;
  name: string;
  reportType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
}

function getDefaultDateRange(type: ReportType): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  let daysBack = 30;
  if (type === "daily_snapshot") daysBack = 1;
  else if (type === "weekly_competitor") daysBack = 7;
  else if (type === "monthly_performance") daysBack = 30;
  else if (type === "own_vs_competitor") daysBack = 30;
  else if (type === "top_content") daysBack = 30;
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  return { from, to };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ReportConfig | null>(null);
  const [reportName, setReportName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  function openGenerate(config: ReportConfig) {
    const range = getDefaultDateRange(config.type);
    setSelectedConfig(config);
    setReportName(config.defaultName);
    setDateFrom(range.from);
    setDateTo(range.to);
    setGenerateError(null);
    setGenerateSuccess(null);
    setGenerateOpen(true);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConfig) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: selectedConfig.type,
          name: reportName,
          dateFrom,
          dateTo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate report");
      setGenerateSuccess("Report generated successfully.");
      await fetchReports();
      setTimeout(() => setGenerateOpen(false), 1200);
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Could not generate report");
    } finally {
      setGenerating(false);
    }
  }

  const reportTypeLabel: Record<string, string> = {
    daily_snapshot: "Daily Snapshot",
    weekly_competitor: "Weekly Competitor",
    monthly_performance: "Monthly Performance",
    own_vs_competitor: "Own vs Competitor",
    top_content: "Top Content",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate and download analytics reports for your tracked accounts.
        </p>
      </div>

      {/* Report type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_CONFIGS.map((config) => (
          <div
            key={config.type}
            className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted shrink-0">{config.icon}</div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">{config.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {config.description}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-auto"
              onClick={() => openGenerate(config)}
            >
              <Plus className="h-3.5 w-3.5" />
              Generate
            </Button>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Past reports */}
      <div>
        <h2 className="text-base font-semibold mb-3">Past Reports</h2>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title="No reports yet"
            description="Generate your first report using one of the templates above."
          />
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date Range</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => {
                    const statusCfg = STATUS_CONFIG[report.status] || {
                      label: report.status,
                      icon: <Clock className="h-3.5 w-3.5" />,
                      className: "bg-gray-100 text-gray-700 border-gray-200",
                    };
                    return (
                      <tr key={report.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[180px]">{report.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {reportTypeLabel[report.reportType] || report.reportType}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`gap-1 text-xs ${statusCfg.className}`}
                          >
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(report.dateFrom).toLocaleDateString()} –{" "}
                          {new Date(report.dateTo).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {report.status === "completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              title="Download CSV"
                            >
                              <a
                                href={`/api/reports/${report.id}/download`}
                                download={`${report.name.replace(/\s+/g, "-").toLowerCase()}.csv`}
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Generate dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate {selectedConfig?.title}</DialogTitle>
            <DialogDescription>
              {selectedConfig?.description}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerate} className="space-y-4">
            {generateError && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {generateError}
              </div>
            )}
            {generateSuccess && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {generateSuccess}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="report-name">Report Name</Label>
              <Input
                id="report-name"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                required
                placeholder="Enter a name for this report"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date-from">From</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date-to">To</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGenerateOpen(false)}
                disabled={generating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generating}>
                {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
