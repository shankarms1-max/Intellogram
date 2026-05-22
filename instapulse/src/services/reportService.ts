import { db } from "@/lib/db";
import { generateMediaCsv, generateAccountsCsv } from "./csvImportService";

export type ReportType =
  | "daily_snapshot"
  | "weekly_competitor"
  | "monthly_performance"
  | "own_vs_competitor"
  | "top_content";

export async function buildReportCsv(
  workspaceId: string,
  reportType: ReportType,
  dateFrom: Date,
  dateTo: Date
): Promise<string> {
  switch (reportType) {
    case "daily_snapshot":
    case "monthly_performance": {
      const accounts = await db.trackedAccount.findMany({
        where: { workspaceId, isActive: true },
        orderBy: { followersCount: "desc" },
      });
      return generateAccountsCsv(accounts);
    }

    case "weekly_competitor":
    case "own_vs_competitor": {
      const accounts = await db.trackedAccount.findMany({
        where: { workspaceId, isActive: true },
        orderBy: [{ accountType: "asc" }, { followersCount: "desc" }],
      });
      return generateAccountsCsv(accounts);
    }

    case "top_content": {
      const media = await db.mediaItem.findMany({
        where: { workspaceId, timestamp: { gte: dateFrom, lte: dateTo } },
        include: { trackedAccount: true },
        orderBy: { engagementRate: "desc" },
        take: 200,
      });
      return generateMediaCsv(media);
    }

    default:
      return "";
  }
}

export async function generateReport(
  workspaceId: string,
  reportType: ReportType,
  name: string,
  dateFrom: Date,
  dateTo: Date
): Promise<{ reportId: string; csvContent?: string }> {
  const report = await db.report.create({
    data: {
      workspaceId,
      reportType,
      name,
      dateFrom,
      dateTo,
      status: "generating",
    },
  });

  try {
    const csvContent = await buildReportCsv(workspaceId, reportType, dateFrom, dateTo);

    await db.report.update({
      where: { id: report.id },
      data: { status: "completed" },
    });

    return { reportId: report.id, csvContent };
  } catch (err) {
    await db.report.update({
      where: { id: report.id },
      data: { status: "failed" },
    });
    throw err;
  }
}
