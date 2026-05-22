import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatPercent(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return `${n.toFixed(decimals)}%`;
}

export function safeDiv(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

export function calcEngagementRate(
  likes: number | null,
  comments: number | null,
  followers: number | null
): number | null {
  if (followers == null || followers === 0) return null;
  const engagement = (likes ?? 0) + (comments ?? 0);
  return safeDiv(engagement, followers) * 100;
}

export function calcPostFrequency(postCount: number, days: number): number {
  return safeDiv(postCount, days);
}

export function calcMarketShare(accountValue: number, totalValue: number): number {
  return safeDiv(accountValue, totalValue) * 100;
}

export function extractHashtags(caption: string | null | undefined): string[] {
  if (!caption) return [];
  const matches = caption.match(/#[\w]+/g);
  return matches ? matches.map((h) => h.toLowerCase()) : [];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getDateRange(days: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, to };
}
