import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const { searchParams } = new URL(request.url);
  const accountType = searchParams.get("accountType");
  const typesParam = searchParams.get("types"); // comma-separated list

  type AccountTypeValue = "own" | "competitor" | "influencer" | "brand" | "other";
  const validTypes = ["own", "competitor", "influencer", "brand", "other"];

  const typeFilter = typesParam
    ? { accountType: { in: typesParam.split(",").filter((t) => validTypes.includes(t)) as AccountTypeValue[] } }
    : accountType
    ? { accountType: accountType as AccountTypeValue }
    : {};

  const accounts = await db.trackedAccount.findMany({
    where: { workspaceId: workspace.id, ...typeFilter },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const body = await request.json();
  const { username, accountType, displayName, notes, fetchLimit } = body;

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const normalizedUsername = username.replace(/^@/, "").toLowerCase().trim();

  const existing = await db.trackedAccount.findUnique({
    where: {
      workspaceId_username: {
        workspaceId: workspace.id,
        username: normalizedUsername,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: `Account @${normalizedUsername} is already being tracked` },
      { status: 409 }
    );
  }

  const account = await db.trackedAccount.create({
    data: {
      workspaceId: workspace.id,
      username: normalizedUsername,
      displayName: displayName || null,
      accountType: accountType || "other",
      notes: notes || null,
      fetchLimit: fetchLimit || 50,
      status: "pending",
      isActive: true,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
