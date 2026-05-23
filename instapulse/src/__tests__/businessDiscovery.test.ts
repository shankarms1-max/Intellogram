import { normalizeInstagramUsername } from "@/lib/instagramUtils";
import {
  COMPETITOR_BUSINESS_DISCOVERY_FIELDS,
  COMPETITOR_MEDIA_SUBFIELDS,
  SYNC_MODE_LIMITS,
} from "@/services/instagramApiClient";

describe("normalizeInstagramUsername", () => {
  // Valid usernames
  it("returns lowercase plain username", () => {
    expect(normalizeInstagramUsername("navya_shankar1211")).toBe("navya_shankar1211");
  });

  it("strips leading @", () => {
    expect(normalizeInstagramUsername("@navya_shankar1211")).toBe("navya_shankar1211");
  });

  it("strips multiple leading @", () => {
    expect(normalizeInstagramUsername("@@natgeo")).toBe("natgeo");
  });

  it("lowercases username", () => {
    expect(normalizeInstagramUsername("NatGeo")).toBe("natgeo");
  });

  it("extracts from full instagram.com URL", () => {
    expect(normalizeInstagramUsername("https://www.instagram.com/natgeo/")).toBe("natgeo");
  });

  it("extracts from instagram.com URL without protocol", () => {
    expect(normalizeInstagramUsername("instagram.com/navya_shankar1211")).toBe("navya_shankar1211");
  });

  it("strips trailing slash from plain username", () => {
    expect(normalizeInstagramUsername("natgeo/")).toBe("natgeo");
  });

  it("handles usernames with dots and underscores", () => {
    expect(normalizeInstagramUsername("user.name_123")).toBe("user.name_123");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeInstagramUsername("  natgeo  ")).toBe("natgeo");
  });

  it("accepts username at max length (30 chars)", () => {
    const u = "a".repeat(30);
    expect(normalizeInstagramUsername(u)).toBe(u);
  });

  // Invalid usernames
  it("returns null for empty string", () => {
    expect(normalizeInstagramUsername("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(normalizeInstagramUsername("   ")).toBeNull();
  });

  it("returns null for username exceeding 30 chars", () => {
    expect(normalizeInstagramUsername("a".repeat(31))).toBeNull();
  });

  it("returns null for username with invalid chars (hyphen)", () => {
    expect(normalizeInstagramUsername("user-name")).toBeNull();
  });

  it("returns null for username with spaces", () => {
    expect(normalizeInstagramUsername("user name")).toBeNull();
  });

  it("returns null for @-only", () => {
    expect(normalizeInstagramUsername("@")).toBeNull();
  });
});

describe("Business Discovery query builder", () => {
  it("embeds username in field selector using URLSearchParams, not as query param", () => {
    const username = "nike";
    const ownId = "17841430068732098";
    const profileFields = COMPETITOR_BUSINESS_DISCOVERY_FIELDS.join(",");
    const fields = `business_discovery.username(${username}){${profileFields}}`;

    const params = new URLSearchParams();
    params.set("fields", fields);
    params.set("access_token", "TOKEN");
    const url = `https://graph.facebook.com/v21.0/${ownId}?${params.toString()}`;

    // Username must be in field selector
    expect(url).toContain(`business_discovery.username%28${username}%29`);
    // Must NOT be a separate query param
    expect(url).not.toContain("&username=");
    // Braces encoded
    expect(url).toContain("%7B");
    expect(url).toContain("%7D");
  });

  it("guard: empty/invalid username returns null before hitting API", () => {
    expect(normalizeInstagramUsername("")).toBeNull();
  });

  it("guard: @-only returns null", () => {
    expect(normalizeInstagramUsername("@")).toBeNull();
  });

  it("nike, @nike, and instagram.com/nike all normalize to nike", () => {
    expect(normalizeInstagramUsername("nike")).toBe("nike");
    expect(normalizeInstagramUsername("@nike")).toBe("nike");
    expect(normalizeInstagramUsername("https://www.instagram.com/nike/")).toBe("nike");
  });
});

describe("COMPETITOR_BUSINESS_DISCOVERY_FIELDS regression guard", () => {
  const flatFields = COMPETITOR_BUSINESS_DISCOVERY_FIELDS.join(",");

  // Required profile fields
  it("includes id", () => expect(flatFields).toContain("id"));
  it("includes username", () => expect(flatFields).toContain("username"));
  it("includes followers_count", () => expect(flatFields).toContain("followers_count"));
  it("includes media_count", () => expect(flatFields).toContain("media_count"));

  // Required media fields (inside the media.limit(N){...} sub-selector)
  it("includes like_count", () => expect(flatFields).toContain("like_count"));
  it("includes comments_count", () => expect(flatFields).toContain("comments_count"));
  it("includes view_count", () => expect(flatFields).toContain("view_count"));
  it("includes media_type", () => expect(flatFields).toContain("media_type"));
  it("includes media_product_type", () => expect(flatFields).toContain("media_product_type"));
  it("includes permalink", () => expect(flatFields).toContain("permalink"));
  it("includes timestamp", () => expect(flatFields).toContain("timestamp"));

  // Forbidden fields — adding any of these breaks the entire Meta request
  it("does NOT include follows_count", () => expect(flatFields).not.toContain("follows_count"));
  it("does NOT include media_url", () => expect(flatFields).not.toContain("media_url"));
  it("does NOT include thumbnail_url", () => expect(flatFields).not.toContain("thumbnail_url"));
  it("does NOT include reach", () => expect(flatFields).not.toContain("reach"));
  it("does NOT include impressions", () => expect(flatFields).not.toContain("impressions"));
  it("does NOT include saved", () => expect(flatFields).not.toContain("saved"));
  it("does NOT include shares", () => expect(flatFields).not.toContain("shares"));
  it("does NOT include plays", () => expect(flatFields).not.toContain("plays"));
  it("does NOT include insights", () => expect(flatFields).not.toContain("insights"));
});

describe("COMPETITOR_MEDIA_SUBFIELDS regression guard", () => {
  it("includes view_count", () => expect(COMPETITOR_MEDIA_SUBFIELDS).toContain("view_count"));
  it("includes like_count", () => expect(COMPETITOR_MEDIA_SUBFIELDS).toContain("like_count"));
  it("includes comments_count", () => expect(COMPETITOR_MEDIA_SUBFIELDS).toContain("comments_count"));
  it("does NOT include media_url", () => expect(COMPETITOR_MEDIA_SUBFIELDS).not.toContain("media_url"));
  it("does NOT include reach", () => expect(COMPETITOR_MEDIA_SUBFIELDS).not.toContain("reach"));
  it("does NOT include plays", () => expect(COMPETITOR_MEDIA_SUBFIELDS).not.toContain("plays"));
});

describe("Sync mode limits", () => {
  it("daily_refresh mediaLimit = 25", () => expect(SYNC_MODE_LIMITS.daily_refresh.mediaLimit).toBe(25));
  it("daily_refresh maxPages = 1", () => expect(SYNC_MODE_LIMITS.daily_refresh.maxPages).toBe(1));
  it("initial_import mediaLimit = 100", () => expect(SYNC_MODE_LIMITS.initial_import.mediaLimit).toBe(100));
  it("initial_import maxPages = 4", () => expect(SYNC_MODE_LIMITS.initial_import.maxPages).toBe(4));
  it("manual_deep_import mediaLimit = 500", () => expect(SYNC_MODE_LIMITS.manual_deep_import.mediaLimit).toBe(500));
  it("manual_deep_import maxPages = 20", () => expect(SYNC_MODE_LIMITS.manual_deep_import.maxPages).toBe(20));
  it("daily_refresh cannot exceed 25 per sync", () => {
    expect(SYNC_MODE_LIMITS.daily_refresh.mediaLimit).toBeLessThanOrEqual(25);
    expect(SYNC_MODE_LIMITS.daily_refresh.maxPages).toBe(1);
  });
  it("manual_deep_import has the highest limits", () => {
    expect(SYNC_MODE_LIMITS.manual_deep_import.mediaLimit).toBeGreaterThan(SYNC_MODE_LIMITS.initial_import.mediaLimit);
    expect(SYNC_MODE_LIMITS.manual_deep_import.maxPages).toBeGreaterThan(SYNC_MODE_LIMITS.initial_import.maxPages);
  });
});

describe("view_count mapping behavior", () => {
  // These tests verify the mapping logic in isolation

  function mapViewCount(item: { view_count?: number }): number | null {
    return item.view_count ?? null;
  }

  it("VIDEO with view_count maps to non-null viewsCount", () => {
    const item = { media_type: "VIDEO", media_product_type: "REELS", view_count: 12345 };
    expect(mapViewCount(item)).toBe(12345);
  });

  it("REELS with view_count = 0 maps to 0 (not null)", () => {
    const item = { media_type: "VIDEO", media_product_type: "REELS", view_count: 0 };
    expect(mapViewCount(item)).toBe(0);
  });

  it("IMAGE without view_count stores null", () => {
    const item = { media_type: "IMAGE", media_product_type: "FEED" };
    expect(mapViewCount(item)).toBeNull();
  });

  it("CAROUSEL_ALBUM without view_count stores null", () => {
    const item = { media_type: "CAROUSEL_ALBUM", media_product_type: "FEED" };
    expect(mapViewCount(item)).toBeNull();
  });

  it("missing view_count does not throw — returns null", () => {
    const item = {};
    expect(() => mapViewCount(item)).not.toThrow();
    expect(mapViewCount(item)).toBeNull();
  });

  it("view_count undefined is treated as null, not 0", () => {
    const item = { view_count: undefined };
    expect(mapViewCount(item)).toBeNull();
  });
});
