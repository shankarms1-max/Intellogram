import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** GET /api/meta/config-status — returns which platform env vars are set (no values). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    hasAppId: Boolean(process.env.META_APP_ID && process.env.META_APP_ID !== "your-meta-app-id"),
    hasAppSecret: Boolean(process.env.META_APP_SECRET && process.env.META_APP_SECRET.length > 0),
  });
}
