import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import { generateAccountsCsv } from "@/services/csvImportService";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const url = new URL(req.url);
  const accountType = url.searchParams.get("accountType");
  type AccountTypeValue = "own" | "competitor" | "influencer" | "brand" | "other";

  const accounts = await db.trackedAccount.findMany({
    where: {
      workspaceId: workspace.id,
      ...(accountType ? { accountType: accountType as AccountTypeValue } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const csv = generateAccountsCsv(accounts);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="channel-radar-accounts-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
