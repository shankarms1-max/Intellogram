import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { encryptToken, decryptToken } from "@/lib/encryption";

export type CredentialMode = "managed" | "byok_app" | "byok_token";

export type CredentialStatus =
  | "active"
  | "expired"
  | "invalid"
  | "missing_permissions"
  | "rate_limited"
  | "unconfigured";

/** Safe config returned to the browser — no secrets. */
export interface WorkspaceCredentialConfig {
  mode: CredentialMode;
  status: CredentialStatus;
  metaAppId: string | null;
  hasMetaAppSecret: boolean;
  hasAccessToken: boolean;
  instagramUserId: string | null;
  instagramUsername: string | null;
  igBusinessAccountId: string | null;
  tokenExpiresAt: Date | null;
  tokenScopes: string[];
  lastValidatedAt: Date | null;
  validationError: string | null;
}

/** App credentials used to drive OAuth or token exchange. */
export interface OAuthAppCredentials {
  appId: string;
  appSecret: string;
}

/** Full credentials resolved for runtime API calls. */
export interface ResolvedCredentials {
  mode: CredentialMode;
  appId: string;
  appSecret: string;
  /** Set only in byok_token mode: the token itself. */
  accessToken?: string;
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getWorkspaceCredentialConfig(
  workspaceId: string
): Promise<WorkspaceCredentialConfig> {
  const cred = await db.workspaceCredential.findUnique({ where: { workspaceId } });

  if (!cred) {
    return {
      mode: "managed",
      status: "active",
      metaAppId: null,
      hasMetaAppSecret: false,
      hasAccessToken: false,
      instagramUserId: null,
      instagramUsername: null,
      igBusinessAccountId: null,
      tokenExpiresAt: null,
      tokenScopes: [],
      lastValidatedAt: null,
      validationError: null,
    };
  }

  return {
    mode: cred.mode as CredentialMode,
    status: cred.status as CredentialStatus,
    metaAppId: cred.metaAppId,
    hasMetaAppSecret: Boolean(cred.metaAppSecretEncrypted),
    hasAccessToken: Boolean(cred.accessTokenEncrypted),
    instagramUserId: cred.instagramUserId,
    instagramUsername: cred.instagramUsername,
    igBusinessAccountId: cred.igBusinessAccountId ?? null,
    tokenExpiresAt: cred.tokenExpiresAt,
    tokenScopes: cred.tokenScopes,
    lastValidatedAt: cred.lastValidatedAt,
    validationError: cred.validationError,
  };
}

/**
 * Returns the App ID + Secret to use for an OAuth redirect and token exchange.
 * BYOK App workspaces use their own credentials; all others use platform env vars.
 */
export async function resolveOAuthAppCredentials(
  workspaceId: string
): Promise<OAuthAppCredentials> {
  const cred = await db.workspaceCredential.findUnique({ where: { workspaceId } });

  if (cred?.mode === "byok_app" && cred.metaAppId && cred.metaAppSecretEncrypted) {
    return {
      appId: cred.metaAppId,
      appSecret: decryptToken(cred.metaAppSecretEncrypted),
    };
  }

  return {
    appId: process.env.META_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || "",
  };
}

/**
 * Returns full credentials for runtime API calls.
 * In byok_token mode the caller receives the decrypted access token so they
 * can skip the InstagramConnection lookup.
 */
export async function resolveWorkspaceCredentials(
  workspaceId: string
): Promise<ResolvedCredentials> {
  const cred = await db.workspaceCredential.findUnique({ where: { workspaceId } });

  if (cred?.mode === "byok_app" && cred.metaAppId && cred.metaAppSecretEncrypted) {
    return {
      mode: "byok_app",
      appId: cred.metaAppId,
      appSecret: decryptToken(cred.metaAppSecretEncrypted),
    };
  }

  if (cred?.mode === "byok_token" && cred.accessTokenEncrypted) {
    return {
      mode: "byok_token",
      appId: process.env.META_APP_ID || "",
      appSecret: process.env.META_APP_SECRET || "",
      accessToken: decryptToken(cred.accessTokenEncrypted),
    };
  }

  return {
    mode: "managed",
    appId: process.env.META_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || "",
  };
}

// ─── Write ───────────────────────────────────────────────────────────────────

export async function resetToManagedMode(workspaceId: string): Promise<void> {
  await db.workspaceCredential.upsert({
    where: { workspaceId },
    update: {
      mode: "managed",
      metaAppId: null,
      metaAppSecretEncrypted: null,
      accessTokenEncrypted: null,
      tokenScopes: [],
      instagramUserId: null,
      instagramUsername: null,
      tokenExpiresAt: null,
      status: "active",
      validationError: null,
      updatedAt: new Date(),
    },
    create: { workspaceId, mode: "managed", status: "active", tokenScopes: [] },
  });
}

export async function saveByokAppCredentials(
  workspaceId: string,
  metaAppId: string,
  metaAppSecret: string
): Promise<void> {
  await db.workspaceCredential.upsert({
    where: { workspaceId },
    update: {
      mode: "byok_app",
      metaAppId,
      metaAppSecretEncrypted: encryptToken(metaAppSecret),
      // Clear any byok_token data
      accessTokenEncrypted: null,
      tokenScopes: [],
      instagramUserId: null,
      instagramUsername: null,
      tokenExpiresAt: null,
      status: "active",
      validationError: null,
      updatedAt: new Date(),
    },
    create: {
      workspaceId,
      mode: "byok_app",
      metaAppId,
      metaAppSecretEncrypted: encryptToken(metaAppSecret),
      status: "active",
      tokenScopes: [],
    },
  });
}

export async function saveByokToken(
  workspaceId: string,
  token: string,
  tokenInfo: {
    instagramUserId?: string | null;
    instagramUsername?: string | null;
    igBusinessAccountId?: string | null;
    expiresAt?: Date | null;
    scopes: string[];
  }
): Promise<void> {
  await db.workspaceCredential.upsert({
    where: { workspaceId },
    update: {
      mode: "byok_token",
      accessTokenEncrypted: encryptToken(token),
      instagramUserId: tokenInfo.instagramUserId ?? null,
      instagramUsername: tokenInfo.instagramUsername ?? null,
      ...(tokenInfo.igBusinessAccountId !== undefined
        ? { igBusinessAccountId: tokenInfo.igBusinessAccountId }
        : {}),
      tokenExpiresAt: tokenInfo.expiresAt ?? null,
      tokenScopes: tokenInfo.scopes,
      // Clear any byok_app data
      metaAppId: null,
      metaAppSecretEncrypted: null,
      status: "active",
      lastValidatedAt: new Date(),
      validationError: null,
      updatedAt: new Date(),
    },
    create: {
      workspaceId,
      mode: "byok_token",
      accessTokenEncrypted: encryptToken(token),
      instagramUserId: tokenInfo.instagramUserId ?? null,
      instagramUsername: tokenInfo.instagramUsername ?? null,
      igBusinessAccountId: tokenInfo.igBusinessAccountId ?? null,
      tokenExpiresAt: tokenInfo.expiresAt ?? null,
      tokenScopes: tokenInfo.scopes,
      status: "active",
      lastValidatedAt: new Date(),
    },
  });
}

export async function updateCredentialStatus(
  workspaceId: string,
  status: CredentialStatus,
  error?: string,
  rateLimitInfo?: Record<string, unknown>
): Promise<void> {
  await db.workspaceCredential.updateMany({
    where: { workspaceId },
    data: {
      status,
      validationError: error ?? null,
      lastValidatedAt: new Date(),
      ...(rateLimitInfo ? { rateLimitInfo: rateLimitInfo as Prisma.InputJsonValue } : {}),
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** True if the platform Meta App is configured in env vars. */
export function isPlatformMetaConfigured(): boolean {
  const appId = process.env.META_APP_ID;
  return Boolean(appId && appId !== "your-meta-app-id" && appId.length > 0);
}

/** Returns required scopes for full sync capability. */
export const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
] as const;

export function checkMissingScopes(grantedScopes: string[]): string[] {
  return REQUIRED_SCOPES.filter((s) => !grantedScopes.includes(s));
}
