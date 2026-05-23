import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password } = schema.parse(body);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: { name, email, password: hashed },
    });

    const slug = `${slugify(name || "workspace")}-${user.id.slice(0, 6)}`;
    const workspace = await db.workspace.create({
      data: {
        name: `${name}'s Workspace`,
        slug,
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: "owner" },
        },
      },
    });

    return NextResponse.json({ userId: user.id, workspaceId: workspace.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
