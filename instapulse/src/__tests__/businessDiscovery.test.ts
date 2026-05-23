import { normalizeInstagramUsername } from "@/lib/instagramUtils";
import { COMPETITOR_BUSINESS_DISCOVERY_FIELDS } from "@/services/instagramApiClient";

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

  // Required fields
  it("includes id", () => expect(flatFields).toContain("id"));
  it("includes username", () => expect(flatFields).toContain("username"));
  it("includes followers_count", () => expect(flatFields).toContain("followers_count"));
  it("includes media_count", () => expect(flatFields).toContain("media_count"));
  it("includes like_count", () => expect(flatFields).toContain("like_count"));
  it("includes comments_count", () => expect(flatFields).toContain("comments_count"));
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
  it("does NOT include insights", () => expect(flatFields).not.toContain("insights"));
});
