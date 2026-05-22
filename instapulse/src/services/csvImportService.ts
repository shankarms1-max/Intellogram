import Papa from "papaparse";
import { db } from "@/lib/db";

/**
 * Prefix dangerous spreadsheet formula starters to prevent CSV injection.
 * Affects cells that begin with =, +, -, @, \t, \r
 */
function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  // Prefix with a tab if the cell starts with a formula character
  return /^[=+\-@\t\r]/.test(str) ? `\t${str}` : str;
}

export interface CsvAccountRow {
  username: string;
  account_type: string;
  fetch_limit?: string;
  notes?: string;
}

export interface CsvValidationError {
  row: number;
  field: string;
  message: string;
}

export interface CsvImportResult {
  valid: CsvAccountRow[];
  errors: CsvValidationError[];
}

const VALID_ACCOUNT_TYPES = ["own", "competitor", "influencer", "brand", "other"];

export function validateCsvRows(rows: Record<string, string | undefined>[]): CsvImportResult {
  const valid: CsvAccountRow[] = [];
  const errors: CsvValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (!row.username || typeof row.username !== "string" || !row.username.trim()) {
      errors.push({ row: rowNum, field: "username", message: "Username is required" });
      continue;
    }

    const username = row.username.trim().replace(/^@/, "").toLowerCase();

    if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
      errors.push({ row: rowNum, field: "username", message: "Invalid Instagram username format" });
      continue;
    }

    const accountType = (row.account_type || "other").trim().toLowerCase();
    if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
      errors.push({
        row: rowNum,
        field: "account_type",
        message: `Invalid account type. Must be one of: ${VALID_ACCOUNT_TYPES.join(", ")}`,
      });
      continue;
    }

    const fetchLimitStr = row.fetch_limit || "50";
    const fetchLimit = parseInt(fetchLimitStr, 10);
    if (isNaN(fetchLimit) || fetchLimit < 1 || fetchLimit > 500) {
      errors.push({
        row: rowNum,
        field: "fetch_limit",
        message: "fetch_limit must be a number between 1 and 500",
      });
      continue;
    }

    valid.push({
      username,
      account_type: accountType,
      fetch_limit: fetchLimitStr,
      notes: row.notes?.trim() || "",
    });
  }

  return { valid, errors };
}

export function parseCsvText(text: string): { rows: Record<string, string | undefined>[]; parseError?: string } {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (result.errors.length > 0 && result.errors[0].code !== "UndetectableDelimiter") {
    return { rows: [], parseError: result.errors[0].message };
  }

  return { rows: result.data as Record<string, string | undefined>[] };
}

export async function importAccountsFromCsv(
  workspaceId: string,
  csvText: string
): Promise<{
  imported: number;
  skipped: number;
  errors: CsvValidationError[];
  parseError?: string;
}> {
  const { rows, parseError } = parseCsvText(csvText);
  if (parseError) {
    return { imported: 0, skipped: 0, errors: [], parseError };
  }

  const { valid, errors } = validateCsvRows(rows);
  let imported = 0;
  let skipped = 0;

  for (const row of valid) {
    try {
      await db.trackedAccount.upsert({
        where: {
          workspaceId_username: { workspaceId, username: row.username },
        },
        update: {
          accountType: row.account_type as "own" | "competitor" | "influencer" | "brand" | "other",
          fetchLimit: parseInt(row.fetch_limit || "50", 10),
          notes: row.notes,
        },
        create: {
          workspaceId,
          username: row.username,
          accountType: row.account_type as "own" | "competitor" | "influencer" | "brand" | "other",
          fetchLimit: parseInt(row.fetch_limit || "50", 10),
          notes: row.notes,
          status: "pending",
        },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

export function generateAccountsCsv(
  accounts: Array<{
    username: string;
    accountType: string;
    fetchLimit: number;
    notes?: string | null;
    followersCount?: number | null;
    status: string;
    lastSyncedAt?: Date | null;
  }>
): string {
  const rows = accounts.map((a) => ({
    username: sanitizeCsvCell(a.username),
    account_type: sanitizeCsvCell(a.accountType),
    fetch_limit: a.fetchLimit,
    notes: sanitizeCsvCell(a.notes),
    followers: a.followersCount ?? "",
    status: sanitizeCsvCell(a.status),
    last_synced: a.lastSyncedAt ? a.lastSyncedAt.toISOString() : "",
  }));

  return Papa.unparse(rows);
}

export function generateMediaCsv(
  media: Array<{
    trackedAccount?: { username: string } | null;
    mediaType: string;
    caption?: string | null;
    permalink?: string | null;
    timestamp: Date;
    likeCount?: number | null;
    commentsCount?: number | null;
    viewsCount?: number | null;
    engagementRate?: number | null;
    hashtags: string[];
  }>
): string {
  const rows = media.map((m) => ({
    account: sanitizeCsvCell(m.trackedAccount?.username),
    media_type: sanitizeCsvCell(m.mediaType),
    caption: sanitizeCsvCell((m.caption || "").slice(0, 200)),
    permalink: sanitizeCsvCell(m.permalink),
    posted_at: m.timestamp.toISOString(),
    likes: m.likeCount ?? "",
    comments: m.commentsCount ?? "",
    views: m.viewsCount ?? "",
    engagement_rate: m.engagementRate?.toFixed(2) ?? "",
    hashtags: sanitizeCsvCell(m.hashtags.join(" ")),
  }));

  return Papa.unparse(rows);
}
