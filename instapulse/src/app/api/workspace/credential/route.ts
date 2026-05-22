import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import {
  getWorkspaceCredentialConfig,
  resetToManagedMode,
  saveByokAppCredentials,
  isPlatformMetaConfigured,
} from "@/services/credentialService";
import { z } from "zod";

const putSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("managed") }),
  z.object({
    mode: z.literal("byok_app"),
    metaAppId: z.string().min(1, "Meta App ID is required"),
    metaAppSecret: z.string().min(1, "Meta App Secret is required"),
  }),
  z.object({ mode: z.literal("byok_token") }),
]);

/** GET /api/workspace/credential — returns current credential config (no secrets) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  const config = await getWorkspaceCredentialConfig(workspace.id);

  return NextResponse.json({
    ...config,
    platformMetaConfigured: isPlatformMetaConfigured(),
  });
}

/** PUT /api/workspace/credential — set credential mode */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  try {
    const body = await request.json();
    const parsed = putSchema.parse(body);

    if (parsed.mode === "managed") {
      await resetToManagedMode(workspace.id);
      return NextResponse.json({ success: true, mode: "managed" });
    }

    if (parsed.mode === "byok_app") {
      await saveByokAppCredentials(workspace.id, parsed.metaAppId, parsed.metaAppSecret);
      return NextResponse.json({ success: true, mode: "byok_app", metaAppId: parsed.metaAppId });
    }

    if (parsed.mode === "byok_token") {
      // byok_token mode is set via /api/workspace/credential/token
      return NextResponse.json(
        { error: "Use POST /api/workspace/credential/token to save an access token" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update credential" }, { status: 500 });
  }
}
