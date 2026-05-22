import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { seedDemoData } from "@/lib/demoSeed";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as { id: string; name?: string | null; email?: string | null; image?: string | null };
}

export async function getUserWorkspace(userId: string, workspaceId?: string) {
  if (workspaceId) {
    const member = await db.workspaceMember.findFirst({
      where: { workspaceId, userId },
      include: { workspace: true },
    });
    return member?.workspace ?? null;
  }
  const member = await db.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return member?.workspace ?? null;
}

export async function getOrCreateDefaultWorkspace(userId: string, userName?: string | null) {
  const existing = await getUserWorkspace(userId);
  if (existing) return existing;

  const name = `${userName || "My"}'s Workspace`;
  const slug = `workspace-${userId.slice(0, 8)}`;

  const workspace = await db.workspace.create({
    data: {
      name,
      slug,
      ownerId: userId,
      members: {
        create: { userId, role: "owner" },
      },
    },
  });

  if (process.env.DEMO_MODE === "true") {
    await seedDemoData(workspace.id);
  }

  return workspace;
}

export async function assertWorkspaceAccess(workspaceId: string, userId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) throw new Error("Unauthorized: workspace access denied");
  return member;
}
