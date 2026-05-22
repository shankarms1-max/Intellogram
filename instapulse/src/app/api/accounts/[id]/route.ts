import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";

async function getWorkspaceAccount(accountId: string, workspaceId: string) {
  return db.trackedAccount.findFirst({
    where: { id: accountId, workspaceId },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
  const { id } = await params;

  const existing = await getWorkspaceAccount(id, workspace.id);
  if (!existing) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const body = await request.json();
  const { accountType, displayName, notes, fetchLimit, isActive } = body;

  const account = await db.trackedAccount.update({
    where: { id },
    data: {
      ...(accountType !== undefined && { accountType }),
      ...(displayName !== undefined && { displayName }),
      ...(notes !== undefined && { notes }),
      ...(fetchLimit !== undefined && { fetchLimit }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json({ account });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);
  const { id } = await params;

  const existing = await getWorkspaceAccount(id, workspace.id);
  if (!existing) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await db.trackedAccount.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
