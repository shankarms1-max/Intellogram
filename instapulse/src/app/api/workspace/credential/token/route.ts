import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";
import { encryptToken } from "@/lib/encryption";
import { db } from "@/lib/db";
import {
  saveByokToken,
  checkMissingScopes,
  resolveOAuthAppCredentials,
} from "@/services/credentialService";
import {
  validateAccessToken,
  getConnectedInstagramAccounts,
} from "@/services/instagramApiClient";
import { z } from "zod";

const tokenSchema = z.object({
  token: z.string().min(10, "Token appears too short"),
});

/**
 * POST /api/workspace/credential/token
 * Validates a user-supplied long-lived Meta access token, saves it encrypted,
 * and upserts InstagramConnection + TrackedAccount records for any linked
 * Instagram Business/Creator accounts found.
 *
 * This is the BYOK Token mode — no OAuth redirect required.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; name?: string | null };
  const workspace = await getOrCreateDefaultWorkspace(user.id, user.name);

  try {
    const body = await request.json();
    const { token } = tokenSchema.parse(body);

    // Use workspace BYOK App credentials for debug_token validation if available
    const { appId, appSecret } = await resolveOAuthAppCredentials(workspace.id);

    // Step 1: validate token against Meta Graph API
    const validation = await validateAccessToken(token, appId, appSecret);

    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: validation.error || "Token is invalid. Check that it is a valid Meta Graph API access token.",
        },
        { status: 422 }
      );
    }

    // Step 2: check token expiry
    if (validation.expiresAt && validation.expiresAt < new Date()) {
      return NextResponse.json(
        {
          valid: false,
          error: `This token expired on ${validation.expiresAt.toLocaleDateString()}. Generate a new long-lived token.`,
        },
        { status: 422 }
      );
    }

    // Step 3: check required scopes
    const missingScopes = checkMissingScopes(validation.scopes);

    // Step 4: discover linked Instagram accounts and upsert records
    const igAccounts = await getConnectedInstagramAccounts(workspace.id, token);
    const encryptedToken = encryptToken(token);
    const expiresAt = validation.expiresAt;

    for (const account of igAccounts) {
      await db.instagramConnection.upsert({
        where: {
          workspaceId_instagramUserId: {
            workspaceId: workspace.id,
            instagramUserId: account.id,
          },
        },
        update: {
          accessTokenEncrypted: encryptedToken,
          tokenExpiresAt: expiresAt,
          status: "active",
          instagramUsername: account.username,
          scopes: validation.scopes,
          updatedAt: new Date(),
        },
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          instagramUserId: account.id,
          instagramUsername: account.username,
          accessTokenEncrypted: encryptedToken,
          tokenExpiresAt: expiresAt,
          scopes: validation.scopes,
          status: "active",
        },
      });

      await db.trackedAccount.upsert({
        where: {
          workspaceId_username: { workspaceId: workspace.id, username: account.username },
        },
        update: {
          instagramUserId: account.id,
          displayName: account.name,
          profilePictureUrl: account.profile_picture_url,
          biography: account.biography,
          website: account.website,
          followersCount: account.followers_count,
          followsCount: account.follows_count,
          mediaCount: account.media_count,
          status: "active",
          accountType: "own",
          updatedAt: new Date(),
        },
        create: {
          workspaceId: workspace.id,
          instagramUserId: account.id,
          username: account.username,
          displayName: account.name,
          profilePictureUrl: account.profile_picture_url,
          biography: account.biography,
          website: account.website,
          followersCount: account.followers_count,
          followsCount: account.follows_count,
          mediaCount: account.media_count,
          accountType: "own",
          status: "active",
        },
      });
    }

    // Step 5: save credential record
    await saveByokToken(workspace.id, token, {
      instagramUserId: validation.instagramUserId,
      instagramUsername: validation.instagramUsername,
      expiresAt,
      scopes: validation.scopes,
    });

    return NextResponse.json({
      valid: true,
      accountsConnected: igAccounts.length,
      instagramUserId: validation.instagramUserId,
      instagramUsername: validation.instagramUsername,
      scopes: validation.scopes,
      missingScopes,
      expiresAt,
      warning: missingScopes.length > 0
        ? `Token is valid but missing permissions: ${missingScopes.join(", ")}. Some metrics may be unavailable.`
        : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to validate token" }, { status: 500 });
  }
}
