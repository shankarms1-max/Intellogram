import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncOwnAccount } from "@/services/accountSyncService";
import { isWorkspaceRateLimited } from "@/services/instagramApiClient";

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all workspaces with active own accounts and a non-rate-limited credential
  const workspaces = await db.workspace.findMany({
    where: {
      trackedAccounts: {
        some: { isActive: true, accountType: "own" },
      },
    },
    select: { id: true },
  });

  const summary: Array<{
    workspaceId: string;
    skipped?: string;
    synced?: number;
    failed?: number;
    errors?: string[];
  }> = [];

  for (const workspace of workspaces) {
    // Skip rate-limited workspaces
    const rateLimited = await isWorkspaceRateLimited(workspace.id);
    if (rateLimited) {
      summary.push({ workspaceId: workspace.id, skipped: "rate_limited" });
      continue;
    }

    const accounts = await db.trackedAccount.findMany({
      where: { workspaceId: workspace.id, isActive: true, accountType: "own" },
      select: { id: true },
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        const result = await syncOwnAccount(workspace.id, account.id);
        if (result.success) synced++;
        else {
          failed++;
          if (result.error) errors.push(`${account.id}: ${result.error}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${account.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    summary.push({ workspaceId: workspace.id, synced, failed, errors });
  }

  return NextResponse.json({
    ok: true,
    workspacesProcessed: workspaces.length,
    summary,
    runAt: new Date().toISOString(),
  });
}
