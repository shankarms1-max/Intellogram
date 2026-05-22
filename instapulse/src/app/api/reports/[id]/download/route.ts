import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { buildReportCsv, ReportType } from "@/services/reportService";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
  const { id } = await params;

  const report = await db.report.findFirst({
    where: { id, workspaceId: workspace.id },
  });

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (report.status !== "completed") {
    return NextResponse.json({ error: "Report not ready for download" }, { status: 400 });
  }

  const csv = await buildReportCsv(
    workspace.id,
    report.reportType as ReportType,
    report.dateFrom,
    report.dateTo
  );

  const filename = `${report.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
