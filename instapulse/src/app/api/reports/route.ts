import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { generateReport, ReportType } from "@/services/reportService";
import { z } from "zod";

const createSchema = z.object({
  reportType: z.enum([
    "daily_snapshot",
    "weekly_competitor",
    "monthly_performance",
    "own_vs_competitor",
    "top_content",
  ]),
  name: z.string().min(1),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export async function GET(_req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const reports = await db.report.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ reports });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  try {
    const body = await req.json();
    const { reportType, name, dateFrom, dateTo } = createSchema.parse(body);

    const result = await generateReport(
      workspace.id,
      reportType as ReportType,
      name,
      new Date(dateFrom),
      new Date(dateTo)
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
