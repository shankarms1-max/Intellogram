import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { importAccountsFromCsv } from "@/services/csvImportService";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const body = await request.json();
  const { csv } = body;

  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "csv field is required" }, { status: 400 });
  }

  const result = await importAccountsFromCsv(workspace.id, csv);

  if (result.parseError) {
    return NextResponse.json({ error: result.parseError }, { status: 400 });
  }

  return NextResponse.json({
    imported: result.imported,
    skipped: result.skipped,
    errors: result.errors,
  });
}
